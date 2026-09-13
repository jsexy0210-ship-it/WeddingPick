"""배포 요청과 실제 live를 구분하고 API 실패 시 정적 서비스 변경을 막는다."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('render_env_sync', Path(__file__).with_name('render-env-sync.py'))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

SHA = 'a' * 40
OTHER_SHA = 'b' * 40
MANIFEST = {
    'static': {'vars': {'API_URL': 'https://example.invalid'}},
    'weddingpickl-sg': {'vars': {'MODE': 'production'}},
}


class DeployTest(unittest.TestCase):
    def setUp(self):
        self.events = []
        self.env = patch.dict(os.environ, {
            'RENDER_API_KEY': 'test-only-key', 'ALL_SECRETS': '{}',
            'DEPLOY_COMMIT': SHA, 'WAIT_FOR_LIVE': 'true', 'REDEPLOY': 'true',
            'DRY_RUN': 'false', 'SERVICE': '', 'API_SERVICE': 'weddingpickl-sg',
        }, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def call(self, method, path, body=None):
        self.events.append((method, path, body))
        if path.startswith('/services?'):
            name = 'weddingpickl-sg' if 'weddingpickl-sg' in path else 'static'
            identifier = 'api' if name == 'weddingpickl-sg' else 'static'
            return 200, json.dumps([{'service': {'id': identifier, 'name': name}}])
        if method == 'PUT':
            return 200, '{}'
        identifier = path.split('/')[2]
        deploy = {'id': identifier + '-request', 'status': 'live', 'commit': {'id': SHA}}
        return (201, json.dumps(deploy)) if method == 'POST' else (200, json.dumps([{'deploy': deploy}]))

    def run_main(self, call=None, health=True, manifest=None):
        output = io.StringIO()
        def check_health(_base):
            self.events.append(('HEALTH', '', None))
            return health
        with patch.object(sync, 'call', side_effect=call or self.call), \
                patch.object(sync, 'load_manifest', return_value=manifest or MANIFEST), \
                patch.object(sync, 'check_api_health', side_effect=check_health), \
                contextlib.redirect_stdout(output):
            result = sync.main()
        return result, output.getvalue()

    def test_api_live_and_health_precede_static_env_and_exact_sha_is_requested(self):
        result, _ = self.run_main()
        self.assertEqual(result, 0)
        health = next(i for i, event in enumerate(self.events) if event[0] == 'HEALTH')
        static_write = next(i for i, event in enumerate(self.events) if event[0] == 'PUT' and '/static/' in event[1])
        api_poll = next(i for i, event in enumerate(self.events) if event[1] == '/services/api/deploys?limit=20')
        self.assertLess(api_poll, health)
        self.assertLess(health, static_write)
        requests = [event[2] for event in self.events if event[0] == 'POST']
        self.assertEqual(requests, [{'commitId': SHA}, {'commitId': SHA}])

    def test_api_update_failure_stops_before_static_and_never_logs_response_body(self):
        def call(method, path, body=None):
            if method == 'PUT':
                self.events.append((method, path, body))
                return 400, 'sensitive-value-that-must-not-appear'
            return self.call(method, path, body)
        result, output = self.run_main(call)
        self.assertEqual(result, 1)
        self.assertNotIn('sensitive-value-that-must-not-appear', output)
        self.assertFalse(any('/static/' in event[1] for event in self.events))

    def test_api_health_failure_stops_before_static_env(self):
        result, _ = self.run_main(health=False)
        self.assertEqual(result, 1)
        self.assertFalse(any('/static/' in event[1] for event in self.events))

    def test_failed_api_deploy_stops_before_health_and_static(self):
        def call(method, path, body=None):
            if path == '/services/api/deploys?limit=20':
                return 200, json.dumps([{'deploy': {'id': 'api-request', 'status': 'build_failed', 'commit': {'id': SHA}}}])
            return self.call(method, path, body)
        result, _ = self.run_main(call)
        self.assertEqual(result, 1)
        self.assertFalse(any(event[0] == 'HEALTH' or '/static/' in event[1] for event in self.events))

    def test_api_missing_from_manifest_fails_without_network_or_writes(self):
        result, _ = self.run_main(manifest={'static': MANIFEST['static']})
        self.assertEqual(result, 1)
        self.assertEqual(self.events, [])

    def test_api_missing_from_render_fails_before_any_write(self):
        result, _ = self.run_main(call=lambda *_args: (200, '[]'))
        self.assertEqual(result, 1)
        self.assertEqual(self.events, [])

    def test_missing_sha_for_wait_fails_before_any_write(self):
        os.environ.pop('DEPLOY_COMMIT')
        result, _ = self.run_main()
        self.assertEqual(result, 1)
        self.assertEqual(self.events, [])

    def test_missing_requested_id_is_not_success(self):
        def call(method, path, body=None):
            if method == 'POST':
                return 201, '{}'
            return self.call(method, path, body)
        result, _ = self.run_main(call)
        self.assertEqual(result, 1)
        self.assertFalse(any('/static/' in event[1] for event in self.events))

    def test_api_deploy_request_failure_stops_before_static(self):
        def call(method, path, body=None):
            if method == 'POST':
                return 503, 'upstream-response-must-not-be-logged'
            return self.call(method, path, body)
        result, output = self.run_main(call)
        self.assertEqual(result, 1)
        self.assertNotIn('upstream-response-must-not-be-logged', output)
        self.assertFalse(any('/static/' in event[1] for event in self.events))

    def test_static_only_requires_matching_live_api_and_health(self):
        os.environ['SERVICE'] = 'static'
        result, _ = self.run_main()
        self.assertEqual(result, 0)
        self.assertFalse(any(event[0] in ('POST', 'PUT') and '/api/' in event[1] for event in self.events))
        self.assertEqual(next(event[0] for event in self.events if event[0] in ('HEALTH', 'PUT')), 'HEALTH')

    def test_static_only_refuses_stale_api(self):
        os.environ['SERVICE'] = 'static'
        def call(method, path, body=None):
            status, text = self.call(method, path, body)
            return status, text.replace(SHA, OTHER_SHA)
        result, _ = self.run_main(call)
        self.assertEqual(result, 1)
        self.assertFalse(any(event[0] in ('PUT', 'POST') for event in self.events))

    def test_dry_run_only_reads(self):
        os.environ['DRY_RUN'] = 'true'
        result, output = self.run_main()
        self.assertEqual(result, 0)
        self.assertTrue(all(event[0] == 'GET' for event in self.events))
        self.assertIn('선언 확인', output)

    def test_other_live_deploy_cannot_satisfy_wait_and_timeout_is_bounded(self):
        item = {'id': 'unrelated-request', 'status': 'live', 'commit': {'id': SHA}}
        with patch.object(sync, 'deploys', return_value=[item]), \
                patch.object(sync.time, 'monotonic', side_effect=[0, 0, 1201]), \
                patch.object(sync.time, 'sleep') as sleep:
            self.assertFalse(sync.wait_for_live('api', 'api-request', SHA))
            sleep.assert_called_once_with(10)

    def test_requested_live_with_wrong_or_missing_commit_fails(self):
        for commit in ({'id': OTHER_SHA}, {}):
            with self.subTest(commit=commit), patch.object(sync, 'deploys', return_value=[
                {'id': 'api-request', 'status': 'live', 'commit': commit}
            ]):
                self.assertFalse(sync.wait_for_live('api', 'api-request', SHA))

    def test_pending_request_waits_for_its_own_live(self):
        pending = {'id': 'api-request', 'status': 'build_in_progress', 'commit': {'id': SHA}}
        live = dict(pending, status='live')
        with patch.object(sync, 'deploys', side_effect=[[pending], [live]]), \
                patch.object(sync.time, 'sleep') as sleep:
            self.assertTrue(sync.wait_for_live('api', 'api-request', SHA))
            sleep.assert_called_once_with(10)

    def test_fallback_parser_does_not_send_yaml_quotes_as_env_values(self):
        result = sync.parse_simple('services:\n  api:\n    vars:\n      DAY: \'2026-09-10\'\n      MODE: "production"\n')
        self.assertEqual(result['api']['vars'], {'DAY': '2026-09-10', 'MODE': 'production'})


if __name__ == '__main__':
    unittest.main()
