/**
 * Form controls, with the prototype's own classes and one error slot per field.
 *
 * A refused save keeps what was typed and marks the field that failed, so the
 * error lands beside the input that caused it rather than in a banner far away.
 */
const join = (...parts) => parts.filter(Boolean).join(' ');

export function Field({ label, htmlFor, hint, error, full, children, className }) {
  return (
    <div className={join('field', full && 'field--full', error && 'field--invalid', className)}>
      {label ? <label htmlFor={htmlFor}>{label}</label> : null}
      {error ? <span className="field__error" data-error-for={htmlFor}>{error}</span> : null}
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ error, ...rest }) {
  return <input aria-invalid={error ? 'true' : undefined} {...rest} />;
}

export function Select({ error, children, ...rest }) {
  return <select aria-invalid={error ? 'true' : undefined} {...rest}>{children}</select>;
}

export function Textarea({ error, ...rest }) {
  return <textarea aria-invalid={error ? 'true' : undefined} {...rest} />;
}

export function Checkline({ id, label, hint, ...rest }) {
  return (
    <div className="checkline">
      <input type="checkbox" id={id} {...rest} />
      <label htmlFor={id}>
        <b>{label}</b>
        {hint ? <span className="field__hint" style={{ display: 'block' }}>{hint}</span> : null}
      </label>
    </div>
  );
}

export function FormGrid({ columns = 2, children, className, ...rest }) {
  return <div className={join('form-grid', columns === 3 && 'form-grid--3', className)} {...rest}>{children}</div>;
}

/** A refused submission names every field that failed, and links to each one. */
export function FormSummary({ title, fields = {} }) {
  const entries = Object.entries(fields);
  if (!entries.length) return null;
  return (
    <div className="alert alert--error" role="alert">
      <span className="alert__icon" aria-hidden="true">!</span>
      <div className="alert__body">
        <span className="alert__title">{title}</span>
        <ul>
          {entries.map(([field, message]) => (
            <li key={field}><a href={`#${field}`}>{message}</a></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SearchBar({ title, note, children, className, ...rest }) {
  return (
    <form className={join('search-bar', className)} {...rest}>
      {title ? <h3>{title}</h3> : null}
      {children}
      {note ? <p className="search-bar__note">{note}</p> : null}
    </form>
  );
}

export function SearchBarRow({ children }) { return <div className="search-bar__row">{children}</div>; }
