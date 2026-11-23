import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { VisaoGeralPage } from './pages/visao-geral/visao-geral.page';
import { UsbPage } from './pages/usb/usb.page';
import { SessaoPage } from './pages/sessao/sessao.page';
import { LogsPage } from './pages/logs/logs.page';
import { RelatorioPage } from './pages/relatorio/relatorio.page';
import { OrigemPipe } from './shared/origem.pipe';

@NgModule({
  declarations: [
    AppComponent,
    VisaoGeralPage,
    UsbPage,
    SessaoPage,
    LogsPage,
    RelatorioPage,
    OrigemPipe,
  ],
  imports: [BrowserModule, FormsModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}
