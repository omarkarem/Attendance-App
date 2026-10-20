import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Dialog from './Dialog';
import Button from './Button';

const ConfirmContext = createContext(null);

/**
 * Replaces window.confirm with an in-app dialog.
 * const confirm = useConfirm();
 * if (await confirm({ title, body, confirmLabel, tone: 'danger' })) { ... }
 */
export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setState(options);
  }), []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!state}
        onClose={() => close(false)}
        title={state?.title}
        description={state?.body}
        size="sm"
        footer={(
          <>
            {/* Destructive confirms focus Cancel so a stray Enter does not delete anything. */}
            <Button variant="secondary" onClick={() => close(false)} data-autofocus={state?.tone === 'danger' ? true : undefined}>
              {state?.cancelLabel || 'Cancel'}
            </Button>
            <Button variant={state?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus={state?.tone === 'danger' ? undefined : true}>
              {state?.confirmLabel || 'Confirm'}
            </Button>
          </>
        )}
      >
        {state?.details}
      </Dialog>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
};
