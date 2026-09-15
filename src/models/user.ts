import type { User as FirebaseUser } from 'firebase/auth';
import { UserInfo } from 'firebase/auth';

export type { FirebaseUser };
export type User = UserInfo;

export const toUser = (user: FirebaseUser): User => {
  return {
    displayName: user.displayName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    photoURL: user.photoURL,
    providerId: user.providerId,
    uid: user.uid,
  };
};
