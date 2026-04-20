interface BuiltinNodeFooterProps {
  nodeId: string;
  items: string[];
}

export const BuiltinNodeFooter = ({ nodeId, items }: BuiltinNodeFooterProps): JSX.Element => {
  return (
    <footer className="ow-builtin-node-footer" data-testid={`builtin-node-footer-${nodeId}`}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </footer>
  );
};
