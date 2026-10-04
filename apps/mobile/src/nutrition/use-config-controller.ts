import AsyncStorage from '@react-native-async-storage/async-storage';
import {useEffect,useState} from 'react';
import {AppState} from 'react-native';
import type {MobileApiClient} from '@/api/client';
import {fetchNutritionConfig,mutateNutritionConfig} from '@/api/nutrition-config';
import {fetchMobileNutritionDay} from '@/api/nutrition-day';
import {shouldRefreshOnForeground} from '@/api/resource';
import {ConfigurationController,type ConfigState} from './config-controller';
import {ConfigurationIntentRepository} from './config-storage';
export function useConfigurationController(client:MobileApiClient|null,userId:string,invalidate:()=>void){
 const [current,setCurrent]=useState<{client:MobileApiClient;userId:string;controller:ConfigurationController;state:ConfigState}|null>(null);
 useEffect(()=>{if(!client)return;const life=new AbortController();const controller=new ConfigurationController({read:()=>fetchNutritionConfig(client,life.signal),write:i=>mutateNutritionConfig(client,i,life.signal),refreshToday:async date=>(await fetchMobileNutritionDay(client,date,life.signal)).status==='ok'},new ConfigurationIntentRepository(AsyncStorage,userId),invalidate);
 const unsubscribe=controller.subscribe(()=>setCurrent({client,userId,controller,state:controller.getSnapshot()}));void controller.initialize();
 let previous=AppState.currentState;const s=AppState.addEventListener('change',next=>{if(shouldRefreshOnForeground(previous,next)&&controller.getSnapshot().open)void controller.load();previous=next;});
 return()=>{s.remove();unsubscribe();controller.dispose();life.abort();};
 },[client,userId,invalidate]);return current?.client===client&&current.userId===userId?current:null;
}
