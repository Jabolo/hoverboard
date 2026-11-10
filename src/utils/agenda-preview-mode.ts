// Replaced at build time. A URL or storage value can never enable the draft.
const buildFlag: string = '__AGENDA_PREVIEW_BUILD__';

export function isAgendaPreviewEnabled(hostname: string, flag = buildFlag): boolean {
  return flag === '1' && ['localhost', '127.0.0.1'].includes(hostname);
}
