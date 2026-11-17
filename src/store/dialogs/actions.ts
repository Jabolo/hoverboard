import { store } from '../';
import { FeedbackDialog, SubscribeDialog } from './state';
import { CLOSE_DIALOG, DIALOG, OPEN_DIALOG } from './types';

export const closeDialog = () => {
  store.dispatch({
    type: CLOSE_DIALOG,
  });
};

export const openSigninDialog = async () => {
  await import('../../elements/dialogs/signin-dialog');
  store.dispatch({
    type: OPEN_DIALOG,
    payload: { name: DIALOG.SIGNIN },
  });
};

export const openSubscribeDialog = async (data: SubscribeDialog['data']) => {
  await import('../../elements/dialogs/subscribe-dialog');
  store.dispatch({
    type: OPEN_DIALOG,
    payload: { name: DIALOG.SUBSCRIBE, data },
  });
};

export const openFeedbackDialog = async (data: FeedbackDialog['data']) => {
  await import('../../elements/dialogs/feedback-dialog');
  store.dispatch({
    type: OPEN_DIALOG,
    payload: { name: DIALOG.FEEDBACK, data },
  });
};
