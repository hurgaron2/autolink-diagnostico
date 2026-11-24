package com.autolink.diagnostico

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.OutputStream

/**
 * Plugin para gravação de arquivos em armazenamento público (Downloads).
 *
 * Usa MediaStore.Downloads, que não requer WRITE_EXTERNAL_STORAGE no Android 10+
 * para arquivos criados pelo próprio app. O arquivo fica acessível ao usuário
 * pelo gerenciador de arquivos em Download/AutoLinkDiagnostico/<id-da-sessao>/.
 *
 * Regras: não lê arquivos de outros apps, não requer MANAGE_EXTERNAL_STORAGE,
 * não acessa Android/data.
 */
@CapacitorPlugin(name = "StoragePublic")
class StoragePublicPlugin : Plugin() {

    private val PASTA_RAIZ = "AutoLinkDiagnostico"

    @PluginMethod
    fun salvarEmDownloadsPublico(call: PluginCall) {
        val nomeArquivo = call.getString("nomeArquivo") ?: run {
            call.reject("nomeArquivo é obrigatório", "faltou_nome_arquivo")
            return
        }
        val dadosBase64 = call.getString("dadosBase64") ?: run {
            call.reject("dadosBase64 é obrigatório", "faltou_dados")
            return
        }
        val idSessao = call.getString("idSessao") ?: "sem-sessao"

        try {
            val uri = gravarDownloadsPublico(nomeArquivo, dadosBase64, idSessao)
            val ret = JSObject()
            ret.put("uri", uri.toString())
            ret.put("caminho", "Download/$PASTA_RAIZ/$idSessao/$nomeArquivo")
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("falha ao gravar em Downloads público: ${e.message}", "storage_public", e)
        }
    }

    /** Abre o gerenciador de arquivos na pasta dos diagnósticos. */
    @PluginMethod
    fun abrirPasta(call: PluginCall) {
        try {
            val uri = garantirPasta()
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, DocumentsContract.Document.MIME_TYPE_DIR)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            if (context.packageManager.resolveActivity(intent, 0) == null) {
                call.reject("nenhum aplicativo de arquivos disponível", "sem_app_arquivos")
                return
            }
            val ret = JSObject()
            ret.put("caminho", "Download/$PASTA_RAIZ")
            call.resolve(ret)
            bridge.activity.startActivity(intent)
        } catch (e: Exception) {
            call.reject("falha ao abrir pasta: ${e.message}", "abrir_pasta", e)
        }
    }

    /** Compartilha o ZIP gravado no MediaStore via ACTION_SEND. */
    @PluginMethod
    fun compartilhar(call: PluginCall) {
        val uri = call.getString("uri")?.let { Uri.parse(it) } ?: run {
            call.reject("uri é obrigatório", "faltou_uri")
            return
        }
        try {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/zip"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            call.resolve(JSObject())
            bridge.activity.startActivity(Intent.createChooser(intent, "Compartilhar diagnóstico"))
        } catch (e: Exception) {
            call.reject("falha ao compartilhar: ${e.message}", "compartilhar", e)
        }
    }

    /** Cria a pasta via MediaStore quando ela ainda nao existe e devolve a URI do documento. */
    private fun garantirPasta(): Uri {
        val resolver = context.contentResolver
        val caminho = "${Environment.DIRECTORY_DOWNLOADS}/$PASTA_RAIZ"
        val uriPasta = Uri.parse(
            "content://com.android.externalstorage.documents/document/primary%3A" +
                Environment.DIRECTORY_DOWNLOADS + "%2F$PASTA_RAIZ"
        )
        val selecao = "${MediaStore.MediaColumns.DISPLAY_NAME}=? AND ${MediaStore.MediaColumns.RELATIVE_PATH}=?"
        val argumentos = arrayOf("LEIA-ME.txt", caminho)
        val existe = resolver.query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            arrayOf(MediaStore.MediaColumns._ID),
            selecao,
            argumentos,
            null
        )?.use { it.count > 0 } == true
        if (existe) return uriPasta

        val valores = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, "LEIA-ME.txt")
            put(MediaStore.Downloads.MIME_TYPE, "text/plain")
            put(MediaStore.Downloads.RELATIVE_PATH, caminho)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valores) ?: return uriPasta
        try {
            resolver.openOutputStream(uri, "w")?.use {
                it.write("Pasta dos diagnósticos do AutoLink. Os relatórios ficam em subpastas com o ID da sessão.".toByteArray(Charsets.UTF_8))
            }
            resolver.update(
                uri,
                ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) },
                null,
                null
            )
        } catch (_: Exception) {
            // Arquivo marca-passo: a pasta ja foi criada pelo insert.
        }
        return uriPasta
    }

    private fun gravarDownloadsPublico(
        nomeArquivo: String,
        dadosBase64: String,
        idSessao: String
    ): Uri {
        val resolver = context.contentResolver
        val valores = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, nomeArquivo)
            put(MediaStore.Downloads.MIME_TYPE, "application/zip")
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/$PASTA_RAIZ/$idSessao")
            put(MediaStore.Downloads.IS_PENDING, 1)
        }

        val uri: Uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, valores)
            ?: throw Exception("não foi possível criar entrada no MediaStore")

        var stream: OutputStream? = null
        try {
            stream = resolver.openOutputStream(uri, "w")
                ?: throw Exception("não foi possível abrir stream de gravação")

            val dados = java.util.Base64.getDecoder().decode(dadosBase64)
            stream.write(dados)
            stream.flush()

            // Finaliza IS_PENDING para tornar o arquivo visível
            val atualizacao = ContentValues().apply {
                put(MediaStore.Downloads.IS_PENDING, 0)
            }
            resolver.update(uri, atualizacao, null, null)

            return uri
        } finally {
            stream?.close()
        }
    }
}
