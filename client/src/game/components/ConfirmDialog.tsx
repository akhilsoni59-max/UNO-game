export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="gc-choice-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="gc-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <small>LEAVE ACTIVE TABLE</small>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <footer>
          <button type="button" onClick={onCancel}>Stay at table</button>
          <button type="button" className="is-danger" onClick={onConfirm}>{confirmLabel}</button>
        </footer>
      </section>
    </div>
  );
}
