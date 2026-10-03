import { describe,expect,it,jest } from '@jest/globals';
import { fireEvent,render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { OwnlevelThemeProvider } from '@/design-system';
import { DayWriteEditor } from './day-write-editor';
import { DayWriteController } from './day-write-controller';
import { DayWriteRepository } from './day-write-storage';
import { nutritionFixture } from './day-fixture.test-helper';
jest.mock('expo-symbols',()=>({SymbolView:()=>null}));
async function fixture(){
 const data=nutritionFixture('2026-10-01');
 if(data.activity.status==='ok') data.activity.data.metrics.push(
  {...data.activity.data.metrics[0],id:'41300000-0000-4000-8000-000000000001',systemKey:'sleep',label:'Sueño',unit:'min',valueType:'duration',value:485,target:480,isActive:false},
  {...data.activity.data.metrics[0],id:'41300000-0000-4000-8000-000000000002',systemKey:null,label:'Personal',unit:'u',valueType:'integer',value:null,updatedAt:null});
 const controller=new DayWriteController({mutate:async()=>{throw new Error('not sent');},read:async()=>({status:'ok',data,meta:{durationMs:1,httpStatus:200,outcome:'ok'}})},
  new DayWriteRepository({getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}},'editor'),()=>{});
 await controller.initialize();return {controller,data};
}
describe('Native activity/context editor',()=>{
 it('renders configurable integer/decimal/duration inputs and archived history',async()=>{
  const f=await fixture();f.controller.open('metrics',f.data);
  const view=render(<OwnlevelThemeProvider initialMode="light"><DayWriteEditor controller={f.controller} state={f.controller.getSnapshot()}/></OwnlevelThemeProvider>);
  expect(view.getByLabelText('Agua').props.keyboardType).toBe('decimal-pad');expect(view.getByLabelText('Personal').props.keyboardType).toBe('number-pad');
  expect(view.getByText('Sueño · archivada')).toBeTruthy();expect(view.getByLabelText('Sueño horas').props.value).toBe('8');expect(view.getByLabelText('Sueño minutos').props.value).toBe('5');
  fireEvent.press(view.getByText('Quitar valor de Sueño'));
  expect(f.controller.getSnapshot().draft!.metrics['41300000-0000-4000-8000-000000000001']).toEqual({value:'',hours:'',minutes:''});
 });
 it('requests native confirmation before abandoning edited fields',async()=>{
  const f=await fixture();f.controller.open('context',f.data);f.controller.changeContext('target','1900');const alert=jest.spyOn(Alert,'alert');
  const view=render(<OwnlevelThemeProvider initialMode="light"><DayWriteEditor controller={f.controller} state={f.controller.getSnapshot()}/></OwnlevelThemeProvider>);
  fireEvent.press(view.getByText('Cancelar'));expect(alert).toHaveBeenCalledWith('¿Descartar cambios?',expect.any(String),expect.any(Array));expect(f.controller.getSnapshot().draft).not.toBeNull();alert.mockRestore();
 });
});
