import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  signInWithPopup,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  enableNetwork,
  disableNetwork,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../contexts/AuthContext';

export interface UserData {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  role: "creator" | "expert" | "pending";
  name: string;
  phone?: string;
  address?: string;
  bio?: string;
  skills?: string[];
  experience?: string;
  education?: string;
  interests?: string;
  createdAt?: string;
  updatedAt?: string;
  avatar?: string;
}

// Fonctions utilitaires
async function getUserData(uid: string): Promise<User | null> {
  try {
    console.log('Fetching user data for uid:', uid);
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      console.log('User data retrieved:', userData);
      return userData;
    }
    
    console.log('No user data found for uid:', uid);
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

// Fonction de connexion
async function loginUser(email: string, password: string): Promise<User> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    console.log('User logged in:', firebaseUser);
    
    const userData = await getUserData(firebaseUser.uid);
    console.log('User data after login:', userData);
    
    if (!userData) {
      throw new Error('Données utilisateur non trouvées');
    }

    return {
      ...userData,
      displayName: firebaseUser.displayName || userData.name,
      photoURL: firebaseUser.photoURL || userData.avatar,
    };
  } catch (error: any) {
    console.error('Erreur lors de la connexion:', error);
    throw new Error(error.message || 'Une erreur est survenue lors de la connexion');
  }
}

export const authService = {
  // Créer un nouvel utilisateur
  async register(email: string, password: string, userData: Partial<User>): Promise<void> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Créer le document utilisateur dans Firestore
      const newUser: User = {
        uid: user.uid,
        email: email,
        name: userData.name || '',
        role: userData.role || 'creator',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        verified: false,
        showPhone: false,
        showEmail: true,
        rating: '0',
        useDisplayNameOnly: false,
        onboardingCompleted: true,
        ...userData
      };

      await setDoc(doc(db, 'users', user.uid), newUser);
    } catch (error: any) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      throw new Error(error.message || 'Une erreur est survenue lors de la création de l\'utilisateur');
    }
  },

  // Se connecter
  async login(email: string, password: string): Promise<User> {
    try {
      // Tenter la connexion
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Firebase user:', user);

      // Récupérer les données utilisateur depuis Firestore
      const userData = await getUserData(user.uid);
      console.log('User data from Firestore:', userData);

      if (!userData) {
        // Créer un document utilisateur par défaut si nécessaire
        const defaultUserData: User = {
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || '',
          role: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          verified: false,
          showPhone: false,
          showEmail: false,
          rating: '',
          useDisplayNameOnly: false,
          expertise: {
            mainType: undefined,
            subType: undefined,
            description: undefined
          }
        };
        
        await setDoc(doc(db, 'users', user.uid), defaultUserData);
        return defaultUserData;
      }

      return userData;
    } catch (error: any) {
      console.error('Erreur lors de la connexion:', error);
      throw new Error(error.message || 'Une erreur est survenue lors de la connexion');
    }
  },

  // Se déconnecter
  async signOut(): Promise<void> {
    try {
      // Désactiver temporairement le réseau Firestore avant la déconnexion
      // await disableNetwork(db); // Commenté car cause des problèmes
      await firebaseSignOut(auth);
      // Réactiver le réseau après la déconnexion
      // await enableNetwork(db); // Commenté car pas nécessaire si on ne désactive pas
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  },

  // Récupérer les données utilisateur
  async getUserData(uid: string): Promise<User> {
    try {
      console.log('Fetching user data for uid:', uid);
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        return userDoc.data() as User;
      } else {
        // Si le document n'existe pas, créer un document utilisateur par défaut
        const defaultUserData: User = {
          uid,
          email: '',
          name: '',
          role: 'creator',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          verified: false
        };
        
        await setDoc(doc(db, 'users', uid), defaultUserData);
        return defaultUserData;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  },

  // Écouter les changements d'état d'authentification
  onAuthStateChange(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  // Mise à jour du profil utilisateur
  async updateUserProfile(uid: string, userData: Partial<User>) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        ...userData,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      throw error;
    }
  },

  // Mise à jour du rôle de l'utilisateur
  async updateUserRole(userId: string, role: 'expert' | 'creator' | 'influencer'): Promise<User> {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData = {
        role,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(userRef, updateData);
      
      // Récupérer les données mises à jour
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error('Utilisateur non trouvé après la mise à jour');
      }
      
      const userData = userSnap.data() as User;
      console.log('Données utilisateur après mise à jour du rôle:', userData);
      
      return userData;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du rôle:', error);
      throw error;
    }
  },

  // Connexion avec Google
  async signInWithGoogle(): Promise<{ isNewUser: boolean; user: User }> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Vérifier si l'utilisateur existe déjà dans Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const isNewUser = !userDoc.exists();
      
      if (isNewUser) {
        // Créer un nouveau document utilisateur avec les informations de base de Google
        const newUser: User = {
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || '',
          role: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          verified: user.emailVerified,
          showPhone: false,
          showEmail: true,
          rating: '0',
          useDisplayNameOnly: false,
          onboardingCompleted: false,
          photoURL: user.photoURL || undefined
        };

        await setDoc(doc(db, 'users', user.uid), newUser);
        return { isNewUser: true, user: newUser };
      }

      const userData = userDoc.data() as User;
      return { isNewUser: false, user: userData };
    } catch (error: any) {
      console.error('Erreur lors de la connexion avec Google:', error);
      throw new Error(error.message || 'Une erreur est survenue lors de la connexion avec Google');
    }
  },

  // Ré-authentifier l'utilisateur
  async reauthenticate(password?: string): Promise<void> {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('Aucun utilisateur connecté');
    }

    try {
      if (password) {
        // Ré-authentification avec email/mot de passe
        const credential = EmailAuthProvider.credential(
          auth.currentUser.email,
          password
        );
        await reauthenticateWithCredential(auth.currentUser, credential);
      } else {
        // Ré-authentification avec Google
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(auth.currentUser, provider);
      }
    } catch (error) {
      console.error('Erreur lors de la ré-authentification:', error);
      throw error;
    }
  },

  // Supprimer un compte utilisateur
  async deleteAccount(uid: string, password?: string): Promise<void> {
    try {
      // Ré-authentifier l'utilisateur avant la suppression
      await this.reauthenticate(password);
      
      // Supprimer le document utilisateur de Firestore
      await deleteDoc(doc(db, 'users', uid));
      
      // Supprimer les paramètres utilisateur
      await deleteDoc(doc(db, 'userSettings', uid));
      
      // Supprimer le portfolio
      const portfolioQuery = query(collection(db, 'portfolio'), where('creatorId', '==', uid));
      const portfolioSnapshot = await getDocs(portfolioQuery);
      const deletePromises = portfolioSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Supprimer le compte Firebase Auth
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du compte:', error);
      throw error;
    }
  }
}; 