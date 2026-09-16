import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, LineHeight } from '@weddingpick/ui';
import { DelayedLoader } from '@/features/loading/delayed-loader';
import { apiFetch } from './_api';
import { AdminAccountActions, ConfirmCard, useAdminAccess } from './_ui';
import { ContentButton, ContentForm, DeleteContentButton, type ContentField } from '@/features/admin/content-form';

type Clause = { id: string; articleNumber: string; title: string; body: string; sourcePath?: string[] | null };
type Doc = { type: string; label: string; currentVersion: string; latestDraftVersion: string | null; clauses: Clause[]; versions: {version: string; isDraft: boolean}[] };
const FIELDS: ContentField[] = [{key:'articleNumber',label:'조문 번호'},{key:'title',label:'조문 제목'},{key:'body',label:'내용',multiline:true}];
export default function TermsScreen() {
  const access = useAdminAccess();
  const [docs,setDocs] = useState<Doc[]>([]);
  const [active,setActive] = useState('terms');
  const [editing,setEditing] = useState<Clause | 'new' | null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [rev,setRev] = useState(0);
  const [publishing,setPublishing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiFetch('/v1/admin/terms').then((value) => { if(!cancelled){setDocs((value as {documents:Doc[]}).documents);setError(null);}})
      .catch((e:unknown)=>{if(!cancelled)setError(e instanceof Error?e.message:'불러오기 실패');})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[rev]);
  const doc=docs.find((d)=>d.type===active);
  async function act(url:string, body?:unknown) {
    if(busy)return;
    setBusy(true);setError(null);
    try{await apiFetch(url,{method:'POST',...(body?{body:JSON.stringify(body)}:{})});setRev((v)=>v+1);setPublishing(false);}
    catch(e){setError(e instanceof Error?e.message:'저장 실패');}
    finally{setBusy(false);}
  }
  return <View style={styles.root}>
    <View style={styles.header}><Text style={styles.title}>약관 · 방침 관리</Text><ContentButton label="새로 고침" onPress={()=>setRev((v)=>v+1)} /><AdminAccountActions /></View>
    <DelayedLoader active={loading} size={40} />
    {error?<Text style={styles.actionError}>{error}</Text>:null}
    <View style={styles.docTabs}>{docs.map((d)=><Pressable key={d.type} onPress={()=>setActive(d.type)} style={[styles.docTab,active===d.type&&styles.docTabActive]}><Text style={styles.docTabText}>{d.label}</Text></Pressable>)}</View>
    {doc?<View style={styles.docBody}>
      <View style={styles.docMeta}><View><Text style={styles.versionText}>공개 버전: {doc.currentVersion}</Text><Text style={styles.draftText}>초안: {doc.latestDraftVersion??'없음'}</Text></View>
        {doc.latestDraftVersion?<><ContentButton label="조문 등록" disabled={!access.canEdit||busy} onPress={()=>setEditing('new')} /><ContentButton label="초안 공개" disabled={!access.canEdit||busy} onPress={()=>setPublishing(true)} /></>:<ContentButton label="새 초안" disabled={!access.canEdit||busy} onPress={()=>void act('/v1/admin/terms',{doc:active})} />}
      </View>
      <Text style={styles.dateText}>저장한 초안은 검토 후 공개해주세요. 공개하면 웹 문서에 즉시 반영되고 이후 동의에 새 버전이 기록돼요.</Text>
      {doc.latestDraftVersion ? <DeleteContentButton name={`${doc.label} 미공개 초안`} onDelete={async () => { await apiFetch(`/v1/admin/terms/${active}/draft`, { method: 'DELETE' }); setRev((v) => v + 1); }} /> : null}
      <ScrollView>{doc.clauses.map((clause)=><View style={styles.clauseRow} key={clause.id}><View style={styles.clauseMain}><Text style={styles.clauseArticle}>{clause.articleNumber}. {clause.title}</Text><Text style={styles.clauseBody}>{clause.body}</Text></View>
        <ContentButton label="수정" disabled={!access.canEdit||!doc.latestDraftVersion} onPress={()=>setEditing(clause)} />
        {doc.latestDraftVersion?<DeleteContentButton name={clause.title} onDelete={async()=>{await apiFetch(`/v1/admin/terms/${active}/clauses/${clause.id}`,{method:'DELETE'});setRev((v)=>v+1);}} />:null}
      </View>)}</ScrollView>
    </View>:null}
    {editing?<ContentForm title={editing==='new'?'조문 등록':'조문 수정'} fields={editing !== 'new' && editing.sourcePath ? FIELDS.filter((field) => field.key === 'body') : FIELDS} initial={editing==='new'?{articleNumber:'',title:'',body:''}:{articleNumber:editing.articleNumber,title:editing.title,body:editing.body}}
      onClose={()=>setEditing(null)} onSave={async(values)=>{await apiFetch(`/v1/admin/terms/${active}/clauses${editing==='new'?'':`/${editing.id}`}`,{method:editing==='new'?'POST':'PUT',body:JSON.stringify(values)});setRev((v)=>v+1);}} />:null}
    {publishing&&doc?<ConfirmCard title="초안을 공개할까요?" body={doc.label} items={['웹 문서에 즉시 반영돼요.','공개본은 수정·삭제하지 않고 새 초안으로 이어서 고쳐요.','신규 동의 기록에 이 버전을 남겨요.']} cta={busy?'공개 중…':'공개'} onCancel={()=>{if(!busy)setPublishing(false);}} onConfirm={()=>void act(`/v1/admin/terms/${active}/publish`)} />:null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.backgroundSelected },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: { flex: 1, fontSize: FontSize.t5, fontWeight: '700', color: Colors.light.text },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.light.backgroundSelected },
  refreshText: { fontSize: FontSize.t7, color: Colors.light.textSecondary },
  body: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorText: { fontSize: FontSize.t6, color: Colors.light.negative, marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6, backgroundColor: Colors.light.tint },
  retryText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  docTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingHorizontal: 16,
  },
  docTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  docTabActive: { borderBottomColor: Colors.light.tint },
  docTabText: { fontSize: FontSize.t7, color: Colors.light.textAssistive },
  docTabTextActive: { color: Colors.light.tint, fontWeight: '700' },
  draftDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.light.cautionary },
  docBody: { flex: 1 },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.light.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  versionText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text },
  dateText: { fontSize: FontSize.tab, color: Colors.light.textAssistive, marginTop: 2 },
  draftText: { fontSize: FontSize.tab, color: Colors.light.cautionary, marginTop: 2 },
  publishBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
  },
  publishBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  actionError: { fontSize: FontSize.t7, color: Colors.light.negative, padding: 12 },
  clauseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSelected,
  },
  clauseRowZebra: { backgroundColor: Colors.light.backgroundElement },
  clauseMain: { flex: 1, marginRight: 12 },
  clauseArticle: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  clauseBody: { fontSize: FontSize.t7, color: Colors.light.textSecondary, lineHeight: LineHeight.t7 },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: Colors.light.backgroundSelected,
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    flexShrink: 0,
  },
  editBtnText: { fontSize: FontSize.tab, color: Colors.light.textStrong },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: Colors.light.background, borderRadius: 14, padding: 24, width: 600, maxHeight: '85%' },
  modalTitle: { fontSize: FontSize.t6, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  modalSub: { fontSize: FontSize.t7, color: Colors.light.textAssistive, marginBottom: 12 },
  clauseInput: {
    borderWidth: 1,
    borderColor: Colors.light.fieldBorder,
    borderRadius: 6,
    padding: 12,
    fontSize: FontSize.t7,
    minHeight: 240,
    lineHeight: LineHeight.t6,
  },
  saveError: { fontSize: FontSize.t7, color: Colors.light.negative, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: Colors.light.backgroundSelected },
  cancelBtnText: { fontSize: FontSize.t7, color: Colors.light.textStrong },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center', backgroundColor: Colors.light.tint },
  saveBtnText: { fontSize: FontSize.t7, fontWeight: '700', color: Colors.light.background },
  btnDisabled: { opacity: 0.5 },
});
