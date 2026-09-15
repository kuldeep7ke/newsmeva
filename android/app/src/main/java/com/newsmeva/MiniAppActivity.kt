package com.newsmeva

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MiniAppActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var btnBack: ImageButton
    private lateinit var btnMenu: ImageButton
    private lateinit var tvTitle: TextView
    private lateinit var fabTeleprompter: com.google.android.material.floatingactionbutton.FloatingActionButton

    private var isTeleprompter = false
    private var isPlaying = false

    companion object {
        const val EXTRA_APP_TYPE = "app_type"
        const val APP_TYPE_TELEPROMPTER = "teleprompter"
        const val APP_TYPE_SCRIPT_EDITOR = "script_editor"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_mini_app)

        webView = findViewById(R.id.webView)
        btnBack = findViewById(R.id.btnBack)
        btnMenu = findViewById(R.id.btnMenu)
        tvTitle = findViewById(R.id.tvTitle)
        fabTeleprompter = findViewById(R.id.fabTeleprompter)

        val appType = intent.getStringExtra(EXTRA_APP_TYPE) ?: APP_TYPE_TELEPROMPTER
        isTeleprompter = appType == APP_TYPE_TELEPROMPTER

        setupWebView()
        setupViews(appType)
        setupButtons()
    }

    private fun setupViews(appType: String) {
        when (appType) {
            APP_TYPE_TELEPROMPTER -> {
                tvTitle.text = "Teleprompter"
                fabTeleprompter.visibility = View.VISIBLE
                fabTeleprompter.setImageResource(if (isPlaying) R.drawable.ic_stop else R.drawable.ic_play)
            }
            APP_TYPE_SCRIPT_EDITOR -> {
                tvTitle.text = "Script Editor"
                fabTeleprompter.visibility = View.GONE
            }
        }
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportMultipleWindows(false)
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean {
                return false
            }
        }

        webView.webChromeClient = WebChromeClient()
    }

    private fun setupButtons() {
        btnBack.setOnClickListener { onBackPressed() }
        
        btnMenu.setOnClickListener {
            // Show menu options
            // For now, just reload the page
            webView.reload()
        }

        fabTeleprompter.setOnClickListener {
            isPlaying = !isPlaying
            fabTeleprompter.setImageResource(if (isPlaying) R.drawable.ic_stop else R.drawable.ic_play)
            
            // Call JavaScript to play/pause teleprompter
            val jsCode = "javascript:toggleTeleprompter(${isPlaying})"
            webView.evaluatejs(jsCode)
        }
    }

    override fun onResume() {
        super.onResume()
        if (isTeleprompter && isPlaying) {
            val jsCode = "javascript:resumeTeleprompter()"
            webView.evaluatejs(jsCode)
        }
    }

    override fun onPause() {
        super.onPause()
        if (isTeleprompter && isPlaying) {
            val jsCode = "javascript:pauseTeleprompter()"
            webView.evaluatejs(jsCode)
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
