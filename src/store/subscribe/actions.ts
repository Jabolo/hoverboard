import { httpsCallable } from 'firebase/functions';
import { Dispatch } from 'redux';
import { store } from '../';
import { firebaseFunctions } from '../../firebase';
import { DialogData } from '../../models/dialog-form';
import { subscribeBlock } from '../../utils/data';
import { queueSnackbar } from '../snackbars';
import {
  SUBSCRIBE,
  SubscribeActions,
  SUBSCRIBE_FAILURE,
  SUBSCRIBE_RESET,
  SUBSCRIBE_SUCCESS,
} from './types';

type NewsletterConsentRequest = {
  email: string;
  firstName: string;
  lastName: string;
  consentGiven: boolean;
  consentSource: 'devfest_website';
  consentVersion: '2026-09-10';
};

type NewsletterConsentResponse = { ok: boolean };

const registerNewsletterConsent = httpsCallable<
  NewsletterConsentRequest,
  NewsletterConsentResponse
>(firebaseFunctions, 'registerNewsletterConsent');

const setSubscribe = async (data: DialogData): Promise<true> => {
  if (!data.consentGiven) {
    throw new Error('Newsletter consent is required.');
  }

  const response = await registerNewsletterConsent({
    email: data.email,
    firstName: data.firstFieldValue || '',
    lastName: data.secondFieldValue || '',
    consentGiven: true,
    consentSource: 'devfest_website',
    consentVersion: '2026-09-10',
  });

  if (!response.data.ok) {
    throw new Error('Newsletter registration was not accepted.');
  }

  return true;
};

export const subscribe = (data: DialogData) => async (dispatch: Dispatch<SubscribeActions>) => {
  dispatch({
    type: SUBSCRIBE,
  });

  try {
    dispatch({
      type: SUBSCRIBE_SUCCESS,
      payload: await setSubscribe(data),
    });
    store.dispatch(queueSnackbar(subscribeBlock.toast));
  } catch (error) {
    dispatch({
      type: SUBSCRIBE_FAILURE,
      payload: error as Error,
    });
  }
};

export const resetSubscribed = () => {
  store.dispatch({
    type: SUBSCRIBE_RESET,
  });
};
