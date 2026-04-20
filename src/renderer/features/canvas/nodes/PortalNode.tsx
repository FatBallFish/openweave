import { useEffect, useState } from 'react';
import type { OpenWeaveShellBridge } from '../../../../shared/ipc/contracts';
import type { PortalNodeInput } from '../../../../shared/ipc/schemas';
import type { PortalStructureElement } from '../../../../shared/portal/types';
import { PortalToolbar } from '../../portal/PortalToolbar';

interface PortalNodeProps {
  workspaceId: string;
  node: PortalNodeInput;
  onChange: (patch: Partial<Pick<PortalNodeInput, 'x' | 'y' | 'url'>>) => void;
}

const getPortalBridge = (): OpenWeaveShellBridge['portal'] => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) {
    throw new Error('openweaveShell bridge is unavailable');
  }
  return shell.portal;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Portal action failed';
};

export const PortalNode = ({ workspaceId, node, onChange }: PortalNodeProps): JSX.Element => {
  const [portalId, setPortalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string>('Idle');
  const [urlDraft, setUrlDraft] = useState(node.url);
  const [clickSelector, setClickSelector] = useState('#action-button');
  const [inputSelector, setInputSelector] = useState('#message-input');
  const [inputValue, setInputValue] = useState('hello from openweave');
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [structureElements, setStructureElements] = useState<PortalStructureElement[]>([]);

  const loadPortal = async (url: string, persistUrl: boolean): Promise<string> => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await getPortalBridge().loadPortal({
        workspaceId,
        nodeId: node.id,
        url
      });
      if (persistUrl) {
        onChange({ url: response.portal.url });
      }
      setPortalId(response.portal.id);
      setActionMessage('Loaded portal URL');
      return response.portal.id;
    } catch (error) {
      const message = toErrorMessage(error);
      setErrorMessage(message);
      setActionMessage('Load failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const ensurePortalId = async (): Promise<string> => {
    if (portalId) {
      return portalId;
    }
    return loadPortal(node.url, false);
  };

  const runPortalAction = async (
    action: (resolvedPortalId: string) => Promise<void>,
    successMessage: string,
    fallbackMessage: string
  ): Promise<void> => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const resolvedPortalId = await ensurePortalId();
      await action(resolvedPortalId);
      setActionMessage(successMessage);
    } catch (error) {
      setActionMessage(fallbackMessage);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUrlDraft(node.url);
  }, [node.url]);

  useEffect(() => {
    let cancelled = false;
    setPortalId(null);
    setStructureElements([]);
    setScreenshotPath(null);
    setErrorMessage(null);
    setActionMessage('Idle');

    setLoading(true);
    void getPortalBridge()
      .loadPortal({
        workspaceId,
        nodeId: node.id,
        url: node.url
      })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setPortalId(response.portal.id);
        setActionMessage('Loaded portal URL');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(toErrorMessage(error));
        setActionMessage('Load failed');
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, node.id]);

  return (
    <section className="ow-portal-node" data-testid={`portal-node-${node.id}`}>
      <p className="ow-portal-node__session" data-testid={`portal-session-${node.id}`}>
        Session: {portalId ?? 'pending'}
      </p>

      <PortalToolbar
        clickSelector={clickSelector}
        disabled={loading}
        inputSelector={inputSelector}
        inputValue={inputValue}
        nodeId={node.id}
        onCapture={() =>
          void runPortalAction(
            async (resolvedPortalId) => {
              const response = await getPortalBridge().capturePortalScreenshot({
                workspaceId,
                portalId: resolvedPortalId
              });
              setScreenshotPath(response.screenshot.path);
            },
            'Captured screenshot',
            'Capture failed'
          )
        }
        onClickElement={() =>
          void runPortalAction(
            async (resolvedPortalId) => {
              await getPortalBridge().clickPortalElement({
                workspaceId,
                portalId: resolvedPortalId,
                selector: clickSelector
              });
            },
            'Clicked element',
            'Click failed'
          )
        }
        onClickSelectorChange={setClickSelector}
        onInputSelectorChange={setInputSelector}
        onInputText={() =>
          void runPortalAction(
            async (resolvedPortalId) => {
              await getPortalBridge().inputPortalText({
                workspaceId,
                portalId: resolvedPortalId,
                selector: inputSelector,
                value: inputValue
              });
            },
            'Input applied',
            'Input failed'
          )
        }
        onInputValueChange={setInputValue}
        onLoad={() => {
          const nextUrl = urlDraft.trim();
          void loadPortal(nextUrl, true);
        }}
        onReadStructure={() =>
          void runPortalAction(
            async (resolvedPortalId) => {
              const response = await getPortalBridge().readPortalStructure({
                workspaceId,
                portalId: resolvedPortalId
              });
              setStructureElements(response.structure.elements);
            },
            'Read structure',
            'Read structure failed'
          )
        }
        onUrlChange={setUrlDraft}
        url={urlDraft}
      />

      {errorMessage ? (
        <p className="ow-portal-node__error" data-testid={`portal-error-${node.id}`}>
          {errorMessage}
        </p>
      ) : null}

      <div className="ow-portal-node__viewport">
        <div className="ow-portal-node__viewport-header">
          <strong>Managed viewport</strong>
          <span>{loading ? 'Loading' : 'Live'}</span>
        </div>

        <p data-testid={`portal-action-status-${node.id}`}>Status: {actionMessage}</p>
        <p data-testid={`portal-screenshot-path-${node.id}`}>Screenshot: {screenshotPath ?? 'none'}</p>

        <ul className="ow-portal-node__structure" data-testid={`portal-structure-list-${node.id}`}>
          {structureElements.length === 0 ? (
            <li>(no structure)</li>
          ) : (
            structureElements.map((element, index) => (
              <li data-testid={`portal-structure-item-${node.id}-${index}`} key={`${element.tag}-${index}`}>
                {element.tag}: {element.text || '(empty)'}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
};
