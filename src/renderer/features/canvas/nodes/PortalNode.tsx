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

const parseNumberOrUndefined = (value: string): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
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
    <article
      data-testid={`portal-node-${node.id}`}
      style={{
        border: '1px solid #f79009',
        borderRadius: '8px',
        padding: '12px',
        display: 'grid',
        gap: '8px',
        backgroundColor: '#fffaeb'
      }}
    >
      <h3 style={{ margin: 0 }}>Portal</h3>
      <p data-testid={`portal-session-${node.id}`} style={{ margin: 0, color: '#344054' }}>
        Session: {portalId ?? 'pending'}
      </p>

      <div style={{ display: 'flex', gap: '8px' }}>
        <label style={{ display: 'grid', gap: '4px' }}>
          X
          <input
            data-testid={`portal-node-x-${node.id}`}
            onChange={(event) => {
              const nextX = parseNumberOrUndefined(event.currentTarget.value);
              if (nextX !== undefined) {
                onChange({ x: nextX });
              }
            }}
            type="number"
            value={node.x}
          />
        </label>
        <label style={{ display: 'grid', gap: '4px' }}>
          Y
          <input
            data-testid={`portal-node-y-${node.id}`}
            onChange={(event) => {
              const nextY = parseNumberOrUndefined(event.currentTarget.value);
              if (nextY !== undefined) {
                onChange({ y: nextY });
              }
            }}
            type="number"
            value={node.y}
          />
        </label>
      </div>

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
        <p data-testid={`portal-error-${node.id}`} style={{ margin: 0, color: '#b42318' }}>
          {errorMessage}
        </p>
      ) : null}

      <p data-testid={`portal-action-status-${node.id}`} style={{ margin: 0 }}>
        Status: {actionMessage}
      </p>

      <p data-testid={`portal-screenshot-path-${node.id}`} style={{ margin: 0 }}>
        Screenshot: {screenshotPath ?? 'none'}
      </p>

      <ul data-testid={`portal-structure-list-${node.id}`} style={{ margin: 0, paddingLeft: '18px' }}>
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
    </article>
  );
};
