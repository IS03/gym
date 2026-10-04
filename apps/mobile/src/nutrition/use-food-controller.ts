import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect,useState } from 'react';
import { AppState } from 'react-native';
import type { MobileApiClient } from '@/api/client';
import { fetchFood,fetchFoods,mutateFood } from '@/api/nutrition-food';
import { shouldRefreshOnForeground } from '@/api/resource';
import { FoodController,type FoodState } from './food-controller';
import { FoodIntentRepository } from './food-storage';
export function useFoodController(client:MobileApiClient|null,userId:string){
 const [current,setCurrent]=useState<{client:MobileApiClient;userId:string;controller:FoodController;state:FoodState}|null>(null);
 useEffect(()=>{if(!client)return;const lifetime=new AbortController();
  const controller=new FoodController({list:(f,q)=>fetchFoods(client,f,q,lifetime.signal),detail:id=>fetchFood(client,id,lifetime.signal),write:i=>mutateFood(client,i,lifetime.signal)},new FoodIntentRepository(AsyncStorage,userId));
  const unsubscribe=controller.subscribe(()=>setCurrent({client,userId,controller,state:controller.getSnapshot()}));void controller.initialize();
  let previous=AppState.currentState;const subscription=AppState.addEventListener('change',next=>{if(shouldRefreshOnForeground(previous,next)&&controller.getSnapshot().open){void controller.load();if(controller.getSnapshot().phase==='conflict')void controller.loadTruth();}previous=next;});
  return()=>{subscription.remove();unsubscribe();controller.dispose();lifetime.abort();};
 },[client,userId]);
 return current?.client===client&&current.userId===userId?current:null;
}
