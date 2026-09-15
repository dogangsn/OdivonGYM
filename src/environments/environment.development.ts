// Development environment (used automatically by `ng serve` / `npm start`).
// Same Firebase project as production for now — flip `useEmulators` to true
// once you run `firebase emulators:start` locally to work against the
// Auth/Firestore emulators instead of live data.
export const environment = {
  production: false,
  useEmulators: false,
  firebase: {
    apiKey: 'AIzaSyDkwitjFRX-RtPkFntmA-heALTI9Sbk62c',
    authDomain: 'odivongym.firebaseapp.com',
    projectId: 'odivongym',
    storageBucket: 'odivongym.firebasestorage.app',
    messagingSenderId: '560162164944',
    appId: '1:560162164944:web:6c267e1b03a5ca4e4f8ed5',
    measurementId: 'G-K2KJ4FS44E',
  },
  trialDurationDays: 14,
};
