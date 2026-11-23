package com.autolink.diagnostico

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbAccessory
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.SystemClock
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONException

/**
 * Plugin local (passivo) de inspeção USB e identificacao do telefone.
 *
 * Regras de observacao: este plugin NAO abre acessorios, NAO reivindica
 * interfaces, NAO envia controlTransfer/bulkTransfer e NAO registra
 * filtros de intent no AndroidManifest (para nao disputar o Android Auto
 * como aplicativo padrao).
 */
@CapacitorPlugin(name = "AutoLink")
class AutoLinkPlugin : Plugin() {

    private var receiver: BroadcastReceiver? = null

    @PluginMethod
    fun getPhoneInfo(call: PluginCall) {
        val ret = JSObject()
        try {
            ret.put("fabricante", Build.MANUFACTURER)
            ret.put("modelo", Build.MODEL)
            ret.put("marca", Build.BRAND)
            ret.put("android", Build.VERSION.RELEASE)
            ret.put("sdk", Build.VERSION.SDK_INT)
            ret.put("build", Build.DISPLAY)
            ret.put(
                "patch",
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Build.VERSION.SECURITY_PATCH else null
            )
            ret.put("coletadoEm", System.currentTimeMillis())
            ret.put("monotonicMs", SystemClock.elapsedRealtime())
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("falha ao coletar informacoes do telefone: ${e.message}", "phone_info", e)
        }
    }

    @PluginMethod
    fun getAppVersions(call: PluginCall) {
        val ret = JSObject()
        val arr = JSArray()
        try {
            val padrao = JSArray()
            padrao.put("com.google.android.gms")
            padrao.put("com.google.android.projection.gearhead")
            val pacotes = call.getArray("pacotes", padrao) ?: padrao
            val pm = context.packageManager
            for (i in 0 until pacotes.length()) {
                val nome = pacotes.getString(i)
                val o = JSObject()
                o.put("pacote", nome)
                try {
                    val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        pm.getPackageInfo(nome, android.content.pm.PackageManager.PackageInfoFlags.of(0))
                    } else {
                        @Suppress("DEPRECATION")
                        pm.getPackageInfo(nome, 0)
                    }
                    o.put("presente", true)
                    o.put("versionName", info.versionName ?: "")
                    val vc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        info.longVersionCode
                    } else {
                        @Suppress("DEPRECATION")
                        info.versionCode.toLong()
                    }
                    o.put("versionCode", vc)
                } catch (e: android.content.pm.PackageManager.NameNotFoundException) {
                    o.put("presente", false)
                    o.put("erro", "pacote_ausente")
                } catch (e: SecurityException) {
                    o.put("presente", false)
                    o.put("erro", "sem_permissao_de_consulta")
                } catch (e: Exception) {
                    o.put("presente", false)
                    o.put("erro", "falha_consulta:${e.javaClass.simpleName}")
                }
                arr.put(o)
            }
            ret.put("pacotes", arr)
            ret.put("coletadoEm", System.currentTimeMillis())
            call.resolve(ret)
        } catch (e: JSONException) {
            call.reject("argumento 'pacotes' invalido: ${e.message}", "bad_args", e)
        } catch (e: Exception) {
            call.reject("falha ao consultar pacotes: ${e.message}", "pkg_query", e)
        }
    }

    @PluginMethod
    fun getUsbSnapshot(call: PluginCall) {
        val includeSerial = call.getBoolean("includeSerial", false) ?: false
        val ret = JSObject()
        try {
            val um = context.getSystemService(Context.USB_SERVICE) as UsbManager
            val dispositivos = JSArray()
            val notas = JSArray()

            for ((_, device) in um.deviceList) {
                dispositivos.put(descreverDevice(device, includeSerial, notas))
            }

            val acessorios = JSArray()
            val lista = um.accessoryList
            if (lista != null) {
                for (accessory in lista) {
                    acessorios.put(descreverAccessory(accessory, includeSerial))
                }
            }

            if (!includeSerial) {
                notas.put("seriais de dispositivo/acessorio omitidos por padrao")
            }
            notas.put("enumeracao passiva: nenhum acessorio foi aberto e nenhuma interface foi reivindicada")

            ret.put("capturadoEm", System.currentTimeMillis())
            ret.put("monotonicMs", SystemClock.elapsedRealtime())
            ret.put("dispositivos", dispositivos)
            ret.put("acessorios", acessorios)
            ret.put("notas", notas)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("falha ao enumerar USB: ${e.message}", "usb_enum", e)
        }
    }

    private fun descreverDevice(device: UsbDevice, includeSerial: Boolean, notas: JSArray): JSObject {
        val o = JSObject()
        o.put("key", "${device.vendorId}:${device.productId}:${device.deviceId}")
        o.put("vid", device.vendorId)
        o.put("pid", device.productId)
        o.put("classe", device.deviceClass)
        o.put("subclasse", device.deviceSubclass)
        o.put("protocolo", device.deviceProtocol)
        o.put("fabricante", device.manufacturerName)
        o.put("produto", device.productName)
        o.put("versao", device.version)

        if (includeSerial) {
            try {
                @Suppress("DEPRECATION")
                o.put("serial", device.serialNumber)
            } catch (e: SecurityException) {
                o.put("serial", null)
                notas.put("serial de ${device.productName ?: device.deviceId} exige permissao EXTRA_USB_PERMISSION: nao coletado")
            }
        } else {
            o.put("serial", null)
        }

        val interfaces = JSArray()
        try {
            @Suppress("DEPRECATION")
            for (i in 0 until device.interfaceCount) {
                interfaces.put(descreverInterface(device.getInterface(i)))
            }
        } catch (e: Exception) {
            notas.put("nao foi possivel ler interfaces do dispositivo ${device.deviceId}: ${e.message}")
        }
        o.put("interfaces", interfaces)
        return o
    }

    private fun descreverInterface(intf: UsbInterface): JSObject {
        val o = JSObject()
        o.put("id", intf.id)
        o.put("nome", intf.name)
        o.put("classe", intf.interfaceClass)
        o.put("subclasse", intf.interfaceSubclass)
        o.put("protocolo", intf.interfaceProtocol)
        val eps = JSArray()
        for (i in 0 until intf.endpointCount) {
            eps.put(descreverEndpoint(intf.getEndpoint(i)))
        }
        o.put("endpoints", eps)
        return o
    }

    private fun descreverEndpoint(ep: UsbEndpoint): JSObject {
        val o = JSObject()
        o.put("address", ep.address)
        o.put(
            "direcao",
            if (ep.direction == UsbConstants.USB_DIR_IN) "entrada" else "saida"
        )
        o.put("tipo", tipoEndpoint(ep.type))
        o.put("maxPacketSize", ep.maxPacketSize)
        o.put("interval", ep.interval)
        return o
    }

    private fun tipoEndpoint(type: Int): String = when (type) {
        UsbConstants.USB_ENDPOINT_XFER_BULK -> "bulk"
        UsbConstants.USB_ENDPOINT_XFER_INT -> "interrupto"
        UsbConstants.USB_ENDPOINT_XFER_ISOC -> "isocrono"
        UsbConstants.USB_ENDPOINT_XFER_CONTROL -> "controle"
        else -> "desconhecido($type)"
    }

    private fun descreverAccessory(accessory: UsbAccessory, includeSerial: Boolean): JSObject {
        val o = JSObject()
        o.put("key", "${accessory.manufacturer ?: ""}|${accessory.model ?: ""}|${accessory.uri ?: ""}")
        o.put("fabricante", accessory.manufacturer)
        o.put("modelo", accessory.model)
        o.put("descricao", accessory.description)
        o.put("versao", accessory.version)
        o.put("uri", accessory.uri?.toString())
        o.put("serial", if (includeSerial) accessory.serial else null)
        return o
    }

    @PluginMethod
    fun startObserving(call: PluginCall) {
        if (receiver != null) {
            call.resolve()
            return
        }
        try {
            val objectReceiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context, intent: Intent) {
                    val ev = JSObject()
                    ev.put("action", intent.action)
                    ev.put("timestampMs", System.currentTimeMillis())
                    ev.put("monotonicMs", SystemClock.elapsedRealtime())

                    val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                    }
                    if (device != null) {
                        ev.put("vid", device.vendorId)
                        ev.put("pid", device.productId)
                        ev.put("produto", device.productName)
                        ev.put("fabricante", device.manufacturerName)
                    }

                    val accessory: UsbAccessory? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(UsbManager.EXTRA_ACCESSORY, UsbAccessory::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(UsbManager.EXTRA_ACCESSORY)
                    }
                    if (accessory != null) {
                        ev.put("acessorioModelo", accessory.model)
                        ev.put("acessorioFabricante", accessory.manufacturer)
                    }

                    notifyListeners("usbEvent", ev)
                }
            }

            // Receiver dinamico de proposito geral: sem intent-filter no manifest,
            // o app nao disputa a deteccao de acessorio com o Android Auto.
            val filter = IntentFilter().apply {
                addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
                addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
                addAction(UsbManager.ACTION_USB_ACCESSORY_ATTACHED)
                addAction(UsbManager.ACTION_USB_ACCESSORY_DETACHED)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(objectReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                context.registerReceiver(objectReceiver, filter)
            }
            receiver = objectReceiver
            call.resolve()
        } catch (e: Exception) {
            call.reject("falha ao registrar observador USB: ${e.message}", "usb_observe", e)
        }
    }

    @PluginMethod
    fun stopObserving(call: PluginCall) {
        val r = receiver
        if (r != null) {
            try {
                context.unregisterReceiver(r)
            } catch (e: IllegalArgumentException) {
                // ja removido; nada a fazer
            }
            receiver = null
        }
        call.resolve()
    }

    @PluginMethod
    fun getMonotonicMillis(call: PluginCall) {
        val ret = JSObject()
        ret.put("monotonicMs", SystemClock.elapsedRealtime())
        ret.put("wallClockMs", System.currentTimeMillis())
        call.resolve(ret)
    }

    override fun handleOnDestroy() {
        val r = receiver
        if (r != null) {
            try {
                context.unregisterReceiver(r)
            } catch (e: IllegalArgumentException) {
                // ja removido
            }
            receiver = null
        }
        super.handleOnDestroy()
    }
}
