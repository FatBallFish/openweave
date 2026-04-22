import { useI18n } from '../../../i18n/provider';

export const NodeToolbar = (): JSX.Element => {
  const { t } = useI18n();

  return (
    <div className="ow-node-toolbar" data-testid="node-toolbar">
      <strong className="ow-node-toolbar__title">{t('nodeToolbar.title')}</strong>
      <span className="ow-node-toolbar__hint" data-testid="canvas-quick-insert-hint">
        {t('nodeToolbar.quickInsert')}
      </span>
      <span className="ow-node-toolbar__hint" data-testid="canvas-command-menu-hint">
        {t('nodeToolbar.commandMenu')}
      </span>
      <span className="ow-node-toolbar__hint" data-testid="canvas-pan-hint">
        {t('nodeToolbar.pan')}
      </span>
    </div>
  );
};
