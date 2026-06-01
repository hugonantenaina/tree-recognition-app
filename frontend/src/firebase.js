import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAV1mBe4lCO8QilXys8D5d-sw9G6tqRihY',
  authDomain: 'arbrescan-325ce.firebaseapp.com',
  projectId: 'arbrescan-325ce',
  storageBucket: 'arbrescan-325ce.firebasestorage.app',
  messagingSenderId: '884295639571',
  appId: '1:884295639571:web:ce7beb5af3604bdba2d5e6',
  measurementId: 'G-R5SCJCRK14',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);