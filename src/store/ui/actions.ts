import { store } from '../';
import {
  Hero,
  SetViewport,
  SET_HERO_SETTINGS,
  SET_VIEWPORT_SIZE,
  TOGGLE_VIDEO_DIALOG,
  VideoDialog,
} from './types';

export const setViewportSize = (payload: SetViewport) => {
  store.dispatch({
    type: SET_VIEWPORT_SIZE,
    payload,
  });
};

export const closeVideoDialog = () => {
  store.dispatch({
    type: TOGGLE_VIDEO_DIALOG,
    payload: {
      open: false,
      youtubeId: '',
      title: '',
    },
  });
};

export const openVideoDialog = async (payload: Omit<VideoDialog, 'open'>) => {
  await import('../../elements/dialogs/video-dialog');
  store.dispatch({
    type: TOGGLE_VIDEO_DIALOG,
    payload: {
      ...payload,
      open: true,
    },
  });
};

export const setHeroSettings = (payload: Hero) => {
  store.dispatch({
    type: SET_HERO_SETTINGS,
    payload,
  });
};
