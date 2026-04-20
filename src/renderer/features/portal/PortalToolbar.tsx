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
    <section className="ow-portal-toolbar" data-testid={`portal-toolbar-${nodeId}`}>
      <label className="ow-portal-toolbar__field">
        URL
        <input
          className="nodrag nopan"
          data-testid={`portal-url-input-${nodeId}`}
          disabled={disabled}
          onChange={(event) => onUrlChange(event.currentTarget.value)}
          type="text"
          value={url}
        />
      </label>

      <div className="ow-portal-toolbar__actions">
        <button className="nodrag nopan" data-testid={`portal-load-${nodeId}`} disabled={disabled} onClick={onLoad} type="button">
          Open page
        </button>
        <button
          className="nodrag nopan"
          data-testid={`portal-capture-${nodeId}`}
          disabled={disabled}
          onClick={onCapture}
          type="button"
        >
          Capture screenshot
        </button>
        <button
          className="nodrag nopan"
          data-testid={`portal-structure-${nodeId}`}
          disabled={disabled}
          onClick={onReadStructure}
          type="button"
        >
          Read structure
        </button>
      </div>

      <div className="ow-portal-toolbar__grid">
        <label className="ow-portal-toolbar__field">
          Click selector
          <input
            className="nodrag nopan"
            data-testid={`portal-click-selector-${nodeId}`}
            disabled={disabled}
            onChange={(event) => onClickSelectorChange(event.currentTarget.value)}
            type="text"
            value={clickSelector}
          />
        </label>
        <button
          className="nodrag nopan"
          data-testid={`portal-click-${nodeId}`}
          disabled={disabled}
          onClick={onClickElement}
          type="button"
        >
          Click element
        </button>
        <label className="ow-portal-toolbar__field">
          Input selector
          <input
            className="nodrag nopan"
            data-testid={`portal-input-selector-${nodeId}`}
            disabled={disabled}
            onChange={(event) => onInputSelectorChange(event.currentTarget.value)}
            type="text"
            value={inputSelector}
          />
        </label>
        <label className="ow-portal-toolbar__field">
          Input value
          <input
            className="nodrag nopan"
            data-testid={`portal-input-value-${nodeId}`}
            disabled={disabled}
            onChange={(event) => onInputValueChange(event.currentTarget.value)}
            type="text"
            value={inputValue}
          />
        </label>
        <button
          className="nodrag nopan"
          data-testid={`portal-input-${nodeId}`}
          disabled={disabled}
          onClick={onInputText}
          type="button"
        >
          Input text
        </button>
      </div>
    </section>
  );
};
