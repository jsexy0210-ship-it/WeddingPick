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

    def test_renamed_service_does_not_block_the_others_and_still_fails(self):
        """
        이름이 바뀐 서비스 하나가 **나머지 배포를 막지 않는다.** 그래도 실패는 실패다.

        2026-09-15에 `WeddingPick-웹뷰(앱 테스트)`가 Render에서 이름이 바뀌었는데,
        그 자리에서 곧바로 끝내 버려 **그 뒤 서비스는 시도조차 못 했다.** API와
        관리자는 이미 새 커밋으로 올라간 뒤였다 — 반만 배포된 상태가 제일 나쁘다.
        """
        manifest = {
            'weddingpickl-sg': {'vars': {'MODE': 'production'}},
            'gone': {'vars': {'A': '1'}},
            'static': {'vars': {'API_URL': 'https://example.invalid'}},
        }

        def call(method, path, body=None):
            if path.startswith('/services?') and 'gone' in path:
                self.events.append((method, path, body))
                return 200, json.dumps([])
            return self.call(method, path, body)

        result, output = self.run_main(call=call, manifest=manifest)

        # 실패는 그대로다.
        self.assertEqual(result, 1)
        # 없어진 이름이 보고에 남는다.
        self.assertIn('gone', output)
        # **그 뒤 서비스도 실제로 배포됐다** — 여기가 이 시험의 전부다.
        self.assertTrue(any(event[0] == 'PUT' and '/static/' in event[1] for event in self.events))
        self.assertTrue(any(event[0] == 'POST' and event[1] == '/services/static/deploys'
                            for event in self.events))

    def test_transient_break_is_retried_instead_of_abandoning_the_deploy(self):
        """947이 죽은 자리다.

        환경변수 하나가 올라간 직후 다음 PUT이 HTTP 0으로 끊겼고, 스크립트가 그 한 번에
        전체 배포를 포기했다. **환경변수가 바뀌면 Render는 서비스를 재시작한다** — 그래서
        API는 옛 커밋으로 재시작하고 새 커밋은 안 올라간 채로 남았다. DB 마이그레이션은
        이미 들어간 뒤였다.
        """
        attempts = {'n': 0}

        def flaky_once(method, path, body=None):
            if method == 'PUT':
                attempts['n'] += 1
                if attempts['n'] == 1:
                    return 0, '<urlopen error timed out>'
            return self.call(method, path, body)

        with patch.object(sync, 'call_once', side_effect=flaky_once), \
                patch.object(sync.time, 'sleep') as sleep:
            result, _ = self.run_main(call=sync.call)

        # 끊긴 한 번 때문에 배포를 버리지 않는다.
        self.assertEqual(result, 0)
        self.assertGreater(attempts['n'], 1)
        # 기다렸다가 다시 부른다 — 곧바로 다시 부르면 같은 자리에서 또 끊긴다.
        sleep.assert_called()

    def test_answered_rejection_is_not_retried(self):
        """응답이 온 4xx는 다시 불러도 같은 답이 온다. 배포만 늦어진다."""
        attempts = {'n': 0}

        def rejected(method, path, body=None):
            if method == 'PUT':
                attempts['n'] += 1
                return 400, '{"message":"bad"}'
            return self.call(method, path, body)

        with patch.object(sync, 'call_once', side_effect=rejected):
            result, output = self.run_main(call=sync.call)

        self.assertEqual(result, 1)
        self.assertEqual(attempts['n'], 1)
        # 거절 사유 본문은 적지 않는다 — Render가 값을 되비칠 수 있다.
        self.assertNotIn('bad', output)

    def test_deploy_post_is_not_retried(self):
        """끊긴 POST는 서버에서 이미 성공했을 수 있다. 두 번 부르면 배포가 둘 생긴다."""
        attempts = {'n': 0}

        def flaky_post(method, path, body=None):
            if method == 'POST':
                attempts['n'] += 1
                return 0, '<urlopen error timed out>'
            return self.call(method, path, body)

        with patch.object(sync, 'call_once', side_effect=flaky_post):
            result, _ = self.run_main(call=sync.call)

        self.assertEqual(result, 1)
        self.assertEqual(attempts['n'], 1)

    def test_fallback_parser_does_not_send_yaml_quotes_as_env_values(self):
        result = sync.parse_simple('services:\n  api:\n    vars:\n      DAY: \'2026-09-10\'\n      MODE: "production"\n')
        self.assertEqual(result['api']['vars'], {'DAY': '2026-09-10', 'MODE': 'production'})


if __name__ == '__main__':
    unittest.main()
