import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect,useState } from 'react';
import { AppState } from 'react-native';
import type { MobileApiClient } from '@/api/client';
import { fetchSavedMeal,fetchSavedMeals,mutateSavedMeal } from '@/api/nutrition-saved';
import {fetchFoods} from '@/api/nutrition-food';
import { shouldRefreshOnForeground } from '@/api/resource';
import { SavedController,type SavedState } from './saved-controller';
import { SavedIntentRepository } from './saved-storage';
export function useSavedController(client:MobileApiClient|null,userId:string,onConfirmed:()=>void){
 const [current,setCurrent]=useState<{client:MobileApiClient;userId:string;controller:SavedController;state:SavedState}|null>(null);
 useEffect(()=>{if(!client)return;const lifetime=new AbortController();
  const controller=new SavedController({foods:()=>fetchFoods(client,'active','',lifetime.signal),list:(f,q)=>fetchSavedMeals(client,f,q,lifetime.signal),detail:id=>fetchSavedMeal(client,id,lifetime.signal),write:i=>mutateSavedMeal(client,i,lifetime.signal)},new SavedIntentRepository(AsyncStorage,userId),onConfirmed);
  const unsubscribe=controller.subscribe(()=>setCurrent({client,userId,controller,state:controller.getSnapshot()}));void controller.initialize();
  let previous=AppState.currentState;const subscription=AppState.addEventListener('change',next=>{if(shouldRefreshOnForeground(previous,next)&&controller.getSnapshot().open){void controller.load();if(controller.getSnapshot().phase==='conflict')void controller.loadTruth();}previous=next;});
  return()=>{subscription.remove();unsubscribe();controller.dispose();lifetime.abort();};
 },[client,userId,onConfirmed]);
 return current?.client===client&&current.userId===userId?current:null;
}
