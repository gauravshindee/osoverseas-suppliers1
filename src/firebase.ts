import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCzUCPrT2LX9TVzIOyo5DGGWb05FED0O38',
  authDomain: 'osoverseas-inventory.firebaseapp.com',
  projectId: 'osoverseas-inventory',
  storageBucket: 'osoverseas-inventory.appspot.com', // fixed bucket domain
  messagingSenderId: '468796877467',
  appId: '1:468796877467:web:9745cf72134e83445c743e',
  measurementId: 'G-DLZGQSFKEC',
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);
