import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect,useState } from 'react';
import type { MobileApiClient } from '@/api/client';
import { fetchMobileNutritionDay } from '@/api/nutrition-day';
import { mutateNutritionDay } from '@/api/nutrition-day-write';
import { DayWriteController,type DayWriteState } from './day-write-controller';
import { DayWriteRepository } from './day-write-storage';
export function useDayWriteController(client:MobileApiClient|null,userId:string,invalidate:()=>void){
  const [current,setCurrent]=useState<{client:MobileApiClient;userId:string;controller:DayWriteController;state:DayWriteState}|null>(null);
  useEffect(()=>{
    if(!client)return;
    const lifetime=new AbortController();
    const controller=new DayWriteController({mutate:i=>mutateNutritionDay(client,i,lifetime.signal),read:d=>fetchMobileNutritionDay(client,d,lifetime.signal)},new DayWriteRepository(AsyncStorage,userId),invalidate);
    const unsubscribe=controller.subscribe(()=>setCurrent({client,userId,controller,state:controller.getSnapshot()}));
    void controller.initialize();
    return()=>{unsubscribe();controller.dispose();lifetime.abort();};
  },[client,userId,invalidate]);
  return current?.client===client&&current.userId===userId?current:null;
}
