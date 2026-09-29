import { TONE } from '../lib/util';

export function Badge({ text, tone }) {
  return <span className={`badge ${tone || TONE[text] || 'muted'}`}>{text}</span>;
}

export function Tag({ label, value }) {
  return <Badge text={value} tone={TONE[value]} />;
}

export function Stat({ num, label, tone }) {
  return (
    <div className="stat">
      <div className="num" style={tone ? { color: `var(--${tone})` } : undefined}>{num}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export function Msg({ searchParams }) {
  if (!searchParams) return null;
  if (searchParams.error) return <div className="alert error">{searchParams.error}</div>;
  if (searchParams.ok) return <div className="alert ok">{searchParams.ok}</div>;
  return null;
}

// 学生订单进度步骤条
export function Steps({ flags }) {
  // flags: [{label, done, now}]
  return (
    <div className="steps">
      {flags.map((f) => (
        <div key={f.label} className={`step ${f.done ? 'done' : ''} ${f.now ? 'now' : ''}`}>{f.label}</div>
      ))}
    </div>
  );
}
