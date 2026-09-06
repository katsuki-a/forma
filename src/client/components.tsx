import { useId, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { validateValues } from '../contracts/model.ts';
import type { Definition, Field, Issue, Values } from '../contracts/model.ts';

export function Button({ kind = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'secondary' | 'danger' }) {
  return <button type="button" className={`button ${kind === 'primary' ? '' : `button-${kind}`} ${className}`} {...props} />;
}
export function FormField({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return <div className="field"><label htmlFor={id}>{label}</label>{children(id)}{hint && <small className="subtle">{hint}</small>}</div>;
}
export function FieldInput({ field, value, onChange, issues, disabled = false }: { field: Field; value: Values[string] | undefined; onChange: (value: Values[string]) => void; issues: Issue[]; disabled?: boolean }) {
  const id = useId();
  const error = issues.find(issue => issue.fieldId === field.id);
  const props = { id, disabled, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined };
  const multiple = field.type === 'checkbox' || field.type === 'multiselect';
  const text = typeof value === 'string' || typeof value === 'number' ? value : '';
  const selected = Array.isArray(value) ? value : [];
  let input: ReactNode;
  if (field.type === 'textarea') input = <textarea {...props} value={text} onChange={event => onChange(event.target.value)} rows={4} />;
  else if (field.type === 'radio' || field.type === 'checkbox') {
    return <fieldset className="choice-field" disabled={disabled} aria-describedby={error ? `${id}-error` : undefined}><legend>{field.label}</legend>{field.options?.map(option => <label className="choice" key={option}>
      <input type={multiple ? 'checkbox' : 'radio'} name={id} value={option} checked={multiple ? selected.includes(option) : value === option} onChange={event => onChange(multiple ? event.target.checked ? [...selected, option] : selected.filter(v => v !== option) : option)} />{option}
    </label>)}{!multiple && <Button kind="secondary" onClick={() => onChange(null)}>選択を解除</Button>}{error && <p className="error" id={`${id}-error`}>{error.message}</p>}</fieldset>;
  } else if (field.type === 'select' || multiple) input = <select {...props} multiple={multiple} value={multiple ? selected : text} onChange={event => onChange(multiple ? [...event.target.selectedOptions].map(option => option.value) : event.target.value)}>
    {!multiple && <option value="">選んでください</option>}{field.options?.map(option => <option key={option} value={option}>{option}</option>)}
  </select>;
  else input = <input {...props} type={field.type === 'datetime' ? 'datetime-local' : ['number', 'date', 'time', 'url', 'tel', 'email'].includes(field.type) ? field.type : 'text'} step={field.type === 'number' ? 'any' : field.type === 'time' || field.type === 'datetime' ? '1' : undefined} value={text} onChange={event => onChange(field.type === 'number' && event.target.value !== '' ? event.target.valueAsNumber : event.target.value)} />;
  return <div className="field"><label htmlFor={id}>{field.label}</label>{input}{error && <p className="error" id={`${id}-error`}>{error.message}</p>}</div>;
}
export function RecordForm({ definition, initial = {}, onSave, busy, preview = false }: { definition: Definition; initial?: Values; onSave?: (values: Values) => Promise<void>; busy: boolean; preview?: boolean }) {
  const [values, setValues] = useState<Values>(structuredClone(initial));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [checked, setChecked] = useState(false);
  return <form className="record-form" onSubmit={async event => {
    event.preventDefault();
    const errors = validateValues(definition, values);
    setIssues(errors); setChecked(errors.length === 0);
    if (errors.length === 0) await onSave?.(values);
  }}>
    {definition.fields.length === 0 && <p className="notice">項目がまだありません。「項目を編集」から追加できます。</p>}
    {definition.fields.map(field => <FieldInput key={field.id} field={field} value={values[field.id]} disabled={busy} issues={issues} onChange={value => { setChecked(false); setValues({ ...values, [field.id]: value }); }} />)}
    <Button type="submit" disabled={busy}>{preview ? '入力を確認' : '記録を保存'}</Button>
    {checked && preview && <p role="status" className="feedback">入力を確認しました。この動作確認では記録は保存されません。</p>}
  </form>;
}
export function TreeMark() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 28V4M16 14L6 7M16 22L26 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="16" cy="4" r="2" fill="currentColor"/><circle cx="6" cy="7" r="2" fill="currentColor"/><circle cx="26" cy="14" r="2" fill="currentColor"/></svg>;
}
