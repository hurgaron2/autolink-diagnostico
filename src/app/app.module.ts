import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { InicioPage } from './pages/inicio/inicio.page';
import { HistoricoPage } from './pages/historico/historico.page';
import { AjustesPage } from './pages/ajustes/ajustes.page';
import { ComoUsarPage } from './pages/ajustes/como-usar.page';
import { SobrePage } from './pages/ajustes/sobre.page';
import { DiagnosticoPage } from './pages/diagnostico/diagnostico.page';
import { ResultadoPage } from './pages/resultado/resultado.page';
import { DetalhesTecnicosPage } from './pages/detalhes-tecnicos/detalhes-tecnicos.page';
import { DiagnosticoService } from './core/diagnostico.service';

@NgModule({
  declarations: [
    AppComponent,
    InicioPage,
    HistoricoPage,
    AjustesPage,
    ComoUsarPage,
    SobrePage,
    DiagnosticoPage,
    ResultadoPage,
    DetalhesTecnicosPage,
  ],
  imports: [BrowserModule, FormsModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    DiagnosticoService,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
