import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { InicioPage } from './pages/inicio/inicio.page';
import { HistoricoPage } from './pages/historico/historico.page';
import { AjustesPage } from './pages/ajustes/ajustes.page';
import { ComoUsarPage } from './pages/ajustes/como-usar.page';
import { SobrePage } from './pages/ajustes/sobre.page';
import { DiagnosticoPage } from './pages/diagnostico/diagnostico.page';
import { ResultadoPage } from './pages/resultado/resultado.page';
import { DetalhesTecnicosPage } from './pages/detalhes-tecnicos/detalhes-tecnicos.page';

const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio', component: InicioPage },
  { path: 'historico', component: HistoricoPage },
  { path: 'ajustes', component: AjustesPage },
  { path: 'ajustes/como-usar', component: ComoUsarPage },
  { path: 'ajustes/sobre', component: SobrePage },
  { path: 'diagnostico', component: DiagnosticoPage },
  { path: 'resultado/:id', component: ResultadoPage },
  { path: 'detalhes-tecnicos', component: DetalhesTecnicosPage },
  { path: '**', redirectTo: 'inicio' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
