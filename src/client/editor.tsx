import { useState } from 'react';
import { definitionSchema, fieldLabels, fieldTypes } from '../contracts/model.ts';
import type { Definition, Field, FieldType } from '../contracts/model.ts';
import { Button, FormField, RecordForm } from './components.tsx';

export function Editor({ initial, existing, busy, onSave, onCancel }: { initial: Definition; existing: boolean; busy: boolean; onSave: (definition: Definition, publish: boolean) => Promise<void>; onCancel: () => void }) {
  const [definition, setDefinition] = useState(() => structuredClone(initial));
  const [preview, setPreview] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const update = (patch: Partial<Definition>) => { setPreview(false); setDefinition({ ...definition, ...patch }); };
  const updateField = (id: string, patch: Partial<Field>) => update({ fields: definition.fields.map(field => field.id === id ? { ...field, ...patch } : field) });
  const move = (id: string, index: number) => {
    const fields = [...definition.fields];
    const previous = fields.findIndex(field => field.id === id);
    if (previous < 0 || index < 0 || index >= fields.length) return;
    fields.splice(index, 0, fields.splice(previous, 1)[0]); update({ fields });
  };
  const validate = () => { const result = definitionSchema.safeParse(definition); setErrors(result.success ? [] : result.error.issues.map(issue => issue.message)); return result.success; };
  return <>
    <div className="header"><div><h1>{existing ? '項目を編集' : 'アプリを作る'}</h1><p className="subtle">項目を並べて、自分たちに合う記録のかたちを作ります。</p></div><span className="status">下書き</span></div>
    <div className="notice">保存した下書きは、「変更を反映」するまで利用中のアプリに適用されません。</div>
    <form onSubmit={async event => { event.preventDefault(); if (validate()) await onSave(definition, false); }}>
      <fieldset disabled={busy} className="editor-fields">
        <div className="surface">
          <FormField label="アプリ名">{id => <input id={id} value={definition.name} required onChange={event => update({ name: event.target.value })} />}</FormField>
          <FormField label="説明">{id => <textarea id={id} value={definition.description} onChange={event => update({ description: event.target.value })} rows={2} />}</FormField>
          <div className="sample-grid">
            <FormField label="アイコン">{id => <select id={id} value={definition.icon} onChange={event => update({ icon: event.target.value })}><option value="tree">木</option><option value="book">ノート</option><option value="home">家</option></select>}</FormField>
            <FormField label="テーマ">{id => <select id={id} value={definition.theme} onChange={event => update({ theme: event.target.value as Definition['theme'] })}><option value="forest">深緑</option><option value="leaf">葉</option><option value="moss">苔</option></select>}</FormField>
          </div>
        </div>
        <section className="section" aria-label="項目の設定">
          <div className="section-heading"><h2>{definition.name || '新しいアプリ'}の項目</h2><Button kind="secondary" onClick={() => update({ fields: [...definition.fields, { id: `field-${crypto.randomUUID()}`, label: '新しい項目', type: 'text' }] })}>項目を追加</Button></div>
          {definition.fields.length === 0 && <div className="empty"><p>項目はまだありません。「項目を追加」から始めてください。</p></div>}
          <ol className="field-list">{definition.fields.map((field, index) => <li className="surface field-editor" key={field.id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged) move(dragged, index); setDragged(null); }}>
            <div className="section-heading"><h3>{field.label || '名前のない項目'}</h3><span className="drag-handle" draggable onDragStart={() => setDragged(field.id)} onDragEnd={() => setDragged(null)} aria-label={`${field.label}をドラッグ`}>⠿ 並べ替え</span></div>
            <div className="sample-grid">
              <FormField label={`項目${index + 1}の名前`}>{id => <input id={id} value={field.label} required onChange={event => updateField(field.id, { label: event.target.value })} />}</FormField>
              <FormField label={`項目${index + 1}の種類`}>{id => <select id={id} value={field.type} onChange={event => { const type = event.target.value as FieldType; updateField(field.id, { type, options: ['radio', 'select', 'checkbox', 'multiselect'].includes(type) ? field.options ?? ['選択肢1', '選択肢2'] : undefined }); }}>{fieldTypes.map(type => <option value={type} key={type}>{fieldLabels[type]}</option>)}</select>}</FormField>
            </div>
            {['radio', 'select', 'checkbox', 'multiselect'].includes(field.type) && <FormField label={`項目${index + 1}の選択肢`} hint="一行に一つずつ入力してください。">{id => <textarea id={id} value={field.options?.join('\n') ?? ''} onChange={event => updateField(field.id, { options: event.target.value.split('\n') })} rows={3} />}</FormField>}
            <div className="button-row"><Button kind="secondary" aria-label={`${field.label}を上へ`} disabled={index === 0} onClick={() => move(field.id, index - 1)}>上へ</Button><Button kind="secondary" aria-label={`${field.label}を下へ`} disabled={index === definition.fields.length - 1} onClick={() => move(field.id, index + 1)}>下へ</Button><Button kind="danger" aria-label={`${field.label}の項目を削除`} onClick={() => update({ fields: definition.fields.filter(f => f.id !== field.id) })}>項目を削除</Button></div>
          </li>)}</ol>
        </section>
        {errors.length > 0 && <div role="alert" className="error">{errors.map((error, i) => <p key={i}>{error}</p>)}</div>}
        <div className="button-row section"><Button type="submit">{existing ? '下書きを保存' : 'アプリを作成'}</Button><Button kind="secondary" onClick={() => { if (validate()) setPreview(!preview); }}>動作確認</Button>{existing && <Button onClick={async () => { if (validate()) await onSave(definition, true); }}>変更を反映</Button>}<Button kind="secondary" onClick={onCancel}>戻る</Button></div>
      </fieldset>
    </form>
    {preview && <section className="section surface" aria-label="下書きの動作確認"><div className="section-heading"><h2>下書きの動作確認</h2><span className="status">保存されません</span></div><RecordForm definition={definition} busy={busy} preview /></section>}
  </>;
}
