interface PortalToolbarProps {
  nodeId: string;
  disabled: boolean;
  url: string;
  clickSelector: string;
  inputSelector: string;
  inputValue: string;
  onUrlChange: (url: string) => void;
  onClickSelectorChange: (selector: string) => void;
  onInputSelectorChange: (selector: string) => void;
  onInputValueChange: (value: string) => void;
  onLoad: () => void;
  onCapture: () => void;
  onReadStructure: () => void;
  onClickElement: () => void;
  onInputText: () => void;
}

export const PortalToolbar = ({
  nodeId,
  disabled,
  url,
  clickSelector,
  inputSelector,
  inputValue,
  onUrlChange,
  onClickSelectorChange,
  onInputSelectorChange,
  onInputValueChange,
  onLoad,
  onCapture,
  onReadStructure,
  onClickElement,
  onInputText
}: PortalToolbarProps): JSX.Element => {
  return (
    <section
      data-testid={`portal-toolbar-${nodeId}`}
      style={{ display: 'grid', gap: '8px', borderTop: '1px solid #d0d5dd', paddingTop: '8px' }}
    >
      <label style={{ display: 'grid', gap: '4px' }}>
        URL
        <input
          data-testid={`portal-url-input-${nodeId}`}
          disabled={disabled}
          onChange={(event) => onUrlChange(event.currentTarget.value)}
          type="text"
          value={url}
        />
      </label>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button data-testid={`portal-load-${nodeId}`} disabled={disabled} onClick={onLoad} type="button">
          Load
        </button>
        <button
          data-testid={`portal-capture-${nodeId}`}
          disabled={disabled}
          onClick={onCapture}
          type="button"
        >
          Capture screenshot
        </button>
        <button
          data-testid={`portal-structure-${nodeId}`}
          disabled={disabled}
          onClick={onReadStructure}
          type="button"
        >
          Read structure
        </button>
      </div>

      <label style={{ display: 'grid', gap: '4px' }}>
        Click selector
        <input
          data-testid={`portal-click-selector-${nodeId}`}
          disabled={disabled}
          onChange={(event) => onClickSelectorChange(event.currentTarget.value)}
          type="text"
          value={clickSelector}
        />
      </label>
      <button
        data-testid={`portal-click-${nodeId}`}
        disabled={disabled}
        onClick={onClickElement}
        type="button"
      >
        Click element
      </button>

      <label style={{ display: 'grid', gap: '4px' }}>
        Input selector
        <input
          data-testid={`portal-input-selector-${nodeId}`}
          disabled={disabled}
          onChange={(event) => onInputSelectorChange(event.currentTarget.value)}
          type="text"
          value={inputSelector}
        />
      </label>
      <label style={{ display: 'grid', gap: '4px' }}>
        Input value
        <input
          data-testid={`portal-input-value-${nodeId}`}
          disabled={disabled}
          onChange={(event) => onInputValueChange(event.currentTarget.value)}
          type="text"
          value={inputValue}
        />
      </label>
      <button
        data-testid={`portal-input-${nodeId}`}
        disabled={disabled}
        onClick={onInputText}
        type="button"
      >
        Input text
      </button>
    </section>
  );
};
