import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { VisaoGeralPage } from './pages/visao-geral/visao-geral.page';
import { UsbPage } from './pages/usb/usb.page';
import { SessaoPage } from './pages/sessao/sessao.page';
import { LogsPage } from './pages/logs/logs.page';
import { RelatorioPage } from './pages/relatorio/relatorio.page';

const routes: Routes = [
  { path: '', redirectTo: 'visao-geral', pathMatch: 'full' },
  { path: 'visao-geral', component: VisaoGeralPage },
  { path: 'usb', component: UsbPage },
  { path: 'sessao', component: SessaoPage },
  { path: 'logs', component: LogsPage },
  { path: 'relatorio', component: RelatorioPage },
  { path: '**', redirectTo: 'visao-geral' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
