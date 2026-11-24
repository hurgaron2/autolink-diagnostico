import { Component } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { DiagnosticoService } from './core/diagnostico.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private diagnostico: DiagnosticoService) {
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        void (isActive
          ? this.diagnostico.reenumerarAoRetornar()
          : this.diagnostico.registrarSaidaParaSegundoPlano());
      });
    }
  }
}
