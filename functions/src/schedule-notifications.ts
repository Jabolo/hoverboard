// https://github.com/import-js/eslint-plugin-import/issues/1810

import { DocumentData, DocumentSnapshot, getFirestore } from 'firebase-admin/firestore';
// https://github.com/import-js/eslint-plugin-import/issues/1810

import { getMessaging } from 'firebase-admin/messaging';
import * as functions from 'firebase-functions/v1';
import {
  createTimeWindow,
  filterUpcomingTimeslots,
  getTodayDateString,
  parseTimeAndGetFromNow,
} from './time.js';

const removeUserTokens = async (tokensToUsers: Record<string, string>) => {
  const tokensByUser: Record<string, string[]> = {};
  Object.keys(tokensToUsers).forEach((token) => {
    const userId = tokensToUsers[token];
    if (userId) {
      tokensByUser[userId] = tokensByUser[userId] || [];
      tokensByUser[userId].push(token);
    }
  });

  const promises = Object.keys(tokensByUser).map(async (userId) => {
    const ref = getFirestore().collection('notificationsUsers').doc(userId);
    const tokensToDelete = tokensByUser[userId];

    await getFirestore().runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      if (!doc.exists) return;

      const data = doc.data();
      const existingTokens = (data?.tokens || {}) as Record<string, boolean>;
      const remainingTokens: Record<string, boolean> = {};

      Object.keys(existingTokens).forEach((t) => {
        if (!tokensToDelete.includes(t)) {
          remainingTokens[t] = true;
        }
      });

      transaction.set(ref, { tokens: remainingTokens }, { merge: true });
    });
  });

  return Promise.all(promises);
};

const sendPushNotificationToUsers = async (
  userIds: string[],
  payload: { data: Record<string, string> },
) => {
  functions.logger.log(
    'sendPushNotificationToUsers user ids',
    userIds,
    'with notification',
    payload,
  );

  const tokensPromise = userIds.map((id) => {
    return getFirestore().collection('notificationsUsers').doc(id).get();
  });

  const usersTokens: DocumentSnapshot<DocumentData>[] = await Promise.all(tokensPromise);
  const tokensToUsers: Record<string, string> = {};

  usersTokens.forEach((userSnap) => {
    if (!userSnap.exists) return;
    const data = userSnap.data();
    const tokensMap = (data?.tokens || {}) as Record<string, boolean>;
    Object.keys(tokensMap).forEach((token) => {
      tokensToUsers[token] = userSnap.id;
    });
  });

  const tokens = Object.keys(tokensToUsers);
  if (!tokens.length) {
    return;
  }

  const CHUNK_SIZE = 500;
  const tokenBatches: string[][] = [];
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    tokenBatches.push(tokens.slice(i, i + CHUNK_SIZE));
  }

  const tokensToRemove: Record<string, string> = {};

  for (const batch of tokenBatches) {
    try {
      const messagingResponse = await getMessaging().sendEachForMulticast({
        tokens: batch,
        ...payload,
      });

      messagingResponse.responses.forEach((result, index) => {
        const error = result.error;
        if (error) {
          const token = batch[index];
          functions.logger.error('Failure sending notification to', token, error);
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
          ) {
            tokensToRemove[token] = tokensToUsers[token];
          }
        }
      });
    } catch (err) {
      functions.logger.error('FCM multicast batch failed', err);
    }
  }

  return removeUserTokens(tokensToRemove);
};

export const scheduleNotifications = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const notificationsConfigPromise = getFirestore()
      .collection('config')
      .doc('notifications')
      .get();
    const schedulePromise = getFirestore().collection('schedule').get();

    const [notificationsConfigSnapshot, scheduleSnapshot] = await Promise.all([
      notificationsConfigPromise,
      schedulePromise,
    ]);
    const notificationsConfig = notificationsConfigSnapshot.exists
      ? notificationsConfigSnapshot.data()
      : {};

    const schedule = scheduleSnapshot.docs.reduce(
      (acc, doc) => ({ ...acc, [doc.id]: doc.data() }),
      {},
    );
    const todayDay = getTodayDateString(notificationsConfig.timezone);

    if (schedule[todayDay]) {
      const timeWindow = createTimeWindow(3, 3);

      const upcomingTimeslot = filterUpcomingTimeslots(
        schedule[todayDay].timeslots,
        timeWindow,
        10, // notification offset in minutes
        notificationsConfig.timezone,
      );

      const upcomingSessions = upcomingTimeslot.reduce(
        (result, timeslot) =>
          timeslot.sessions.reduce(
            (aggregatedSessions, current) => [...aggregatedSessions, ...current.items],
            result,
          ),
        [],
      );
      const usersIdsSnapshot = await getFirestore().collection('featuredSessions').get();

      await Promise.all(
        upcomingSessions.map(async (upcomingSession, sessionIndex) => {
          const sessionInfoSnapshot = await getFirestore()
            .collection('sessions')
            .doc(upcomingSession)
            .get();
          if (!sessionInfoSnapshot.exists) return undefined;

          const usersIds = usersIdsSnapshot.docs.reduce(
            (acc, doc) => ({ ...acc, [doc.id]: doc.data() }),
            {},
          );

          const userIdsFeaturedSession = Object.keys(usersIds).filter(
            (userId) =>
              !!Object.keys(usersIds[userId]).filter(
                (sessionId) => sessionId.toString() === upcomingSession.toString(),
              ).length,
          );

          const session = sessionInfoSnapshot.data();
          const fromNow = parseTimeAndGetFromNow(
            upcomingTimeslot[0].startTime,
            notificationsConfig.timezone,
          );

          if (userIdsFeaturedSession.length) {
            const payload = {
              data: {
                title: String(session.title || ''),
                body: `Starts ${fromNow}`,
                icon: String(notificationsConfig.icon || ''),
                path: `/sessions/${upcomingSessions[sessionIndex]}`,
              },
            };

            return sendPushNotificationToUsers(userIdsFeaturedSession, payload);
          }

          if (upcomingSessions.length) {
            functions.logger.log('Upcoming sessions', upcomingSessions);
          } else {
            functions.logger.log('There is no sessions right now');
          }

          return undefined;
        }),
      );
    } else {
      functions.logger.log(todayDay, 'was not found in the schedule');
    }
  });
