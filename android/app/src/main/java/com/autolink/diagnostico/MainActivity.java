package com.autolink.diagnostico;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registro antes de super.onCreate() conforme documentacao do Capacitor.
        registerPlugin(AutoLinkPlugin.class);
        registerPlugin(StoragePublicPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
