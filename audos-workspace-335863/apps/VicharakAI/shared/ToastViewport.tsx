/**
 * ToastViewport — the floating toast with a one-tap Undo when the action is
 * reversible. JSX extracted verbatim from App.tsx.
 */
/* eslint-disable */
import { AMBER, BORDER_STRONG, GLASS_BG, RADIUS, TEXT } from '../theme';
import { useApp } from '../app/AppContext';

export default function ToastViewport() {
  const { toast } = useApp();
  const { toastText, toastUndo, clearToast } = toast;
  if (!toastText) return null;
  return (
    <div
      className={`pointer-events-none fixed bottom-24 left-0 right-0 flex justify-center z-40 px-6 ${toastUndo ? 'vicharak-fade' : 'vicharak-toast'}`}
      role="status"
      data-testid="toast-quote"
    >
      <div
        className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 backdrop-blur-md"
        style={{
          borderRadius: RADIUS.chip,
          background: GLASS_BG,
          border: `1px solid ${BORDER_STRONG}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        <p className="text-xs font-bold text-center" style={{ color: TEXT }}>
          “{toastText}”
        </p>
        {toastUndo && (
          <button
            type="button"
            onClick={() => {
              const undo = toastUndo;
              clearToast();
              undo();
            }}
            className="text-xs font-extrabold uppercase tracking-wide flex-shrink-0 touch-manipulation"
            style={{ color: AMBER }}
            data-testid="toast-undo"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
