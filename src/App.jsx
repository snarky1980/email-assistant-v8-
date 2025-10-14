import React, { useState, useEffect, useMemo, useRef } from 'react'
import { loadState, saveState } from './utils/storage.js';
import { Search, FileText, Copy, RotateCcw, Languages, Filter, Globe, Sparkles, Mail, Edit3, Link, Settings, X, Move } from 'lucide-react'
import { Button } from './components/ui/button.jsx'
import { Input } from './components/ui/input.jsx'
import { Textarea } from './components/ui/textarea.jsx'
import HighlightingEditor from './components/HighlightingEditor';
import AISidebar from './components/AISidebar';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card.jsx'
import { Badge } from './components/ui/badge.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select.jsx'
import { Separator } from './components/ui/separator.jsx'
import { ScrollArea } from './components/ui/scroll-area.jsx'
import './App.css'

// Custom CSS for modern typography and variable highlighting with the EXACT original teal/sage styling
const customEditorStyles = `
  /* Translation Bureau Brand Colors - EXACT MATCH from original design */
  :root {
    --tb-teal: #059669;         /* Emerald-600 - Main teal */
    --tb-teal-light: #10b981;   /* Emerald-500 - Light teal */
    --tb-teal-dark: #047857;    /* Emerald-700 - Dark teal */
    --tb-sage: #65a30d;         /* Lime-600 - Sage green */
    --tb-sage-light: #84cc16;   /* Lime-500 - Light sage */
    --tb-mint: #d9f99d;         /* Lime-200 - Mint background */
    --tb-cream: #fefefe;        /* Clean white */
  }

  /* Modern typography base */
  * {
    font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  /* Enhanced variable highlighting styles */
  .variable-highlight {
    background-color: #fef3c7;
    color: #d97706;
    padding: 3px 6px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 15px;
    border: 1px solid #f59e0b;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    letter-spacing: 0.005em;
  }
  
  /* Scrollbar always visible */
  [data-slot="scroll-area-scrollbar"] {
    opacity: 1 !important;
    visibility: visible !important;
  }
  
  [data-slot="scroll-area-thumb"] {
    background-color: #cbd5e1 !important;
    opacity: 1 !important;
  }
  
  [data-slot="scroll-area-scrollbar"]:hover [data-slot="scroll-area-thumb"] {
    background-color: #94a3b8 !important;
  }
  
  /* Remove visual artifacts in inputs */
  input[type="text"], input[type="number"], input {
    list-style: none !important;
    list-style-type: none !important;
    background-image: none !important;
  }
  
  input::before, input::after {
    content: none !important;
    display: none !important;
  }
  
  /* Remove dots/bullets artifacts */
  input::-webkit-list-button {
    display: none !important;
  }
  
  input::-webkit-calendar-picker-indicator {
    display: none !important;
  }
  
  /* Modern editor typography */
  .editor-container {
    position: relative;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  }
  
  .editor-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    padding: 16px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.7;
    letter-spacing: 0.01em;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
    color: transparent;
    z-index: 1;
  }
  
  .editor-overlay .variable {
    background-color: #fef3c7;
    color: #d97706;
    padding: 3px 6px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 15px;
    border: 1px solid #f59e0b;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    letter-spacing: 0.005em;
  }
  
  .editor-textarea {
    position: relative;
    z-index: 2;
    background: transparent !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 400;
    letter-spacing: 0.01em;
  }
  
  /* Input field typography improvements */
  input, textarea {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif !important;
    font-weight: 400;
    letter-spacing: 0.01em;
  }
  
  /* Resizable popup styles */
  .resizable-popup {
    resize: both;
    overflow: auto;
  }
  
  .resizable-popup::-webkit-resizer {
    background-color: var(--tb-teal);
    background-image: linear-gradient(45deg, transparent 50%, var(--tb-teal-dark) 50%);
  }
`

function App() {
  // Inject custom styles for variable highlighting
  useEffect(() => {
    const styleElement = document.createElement('style')
    styleElement.textContent = customEditorStyles
    document.head.appendChild(styleElement)
    return () => document.head.removeChild(styleElement)
  }, [])

  // Debug flag via ?debug=1
  const debug = useMemo(() => {
    try { return new URLSearchParams(window.location.search).has('debug') } catch { return false }
  }, [])

  // Load saved state
  const savedState = loadState()
  
  // State for template data
  const [templatesData, setTemplatesData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Separate interface language from template language
  const [interfaceLanguage, setInterfaceLanguage] = useState(savedState.interfaceLanguage || 'fr') // Interface language
  const [templateLanguage, setTemplateLanguage] = useState(savedState.templateLanguage || 'fr')   // Template language
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [searchQuery, setSearchQuery] = useState(savedState.searchQuery || '')
  const [selectedCategory, setSelectedCategory] = useState(savedState.selectedCategory || 'all')
  const [finalSubject, setFinalSubject] = useState('') // Final editable version
  const [finalBody, setFinalBody] = useState('') // Final editable version
  const [variables, setVariables] = useState(savedState.variables || {})
  const [favorites, setFavorites] = useState(savedState.favorites || [])
  const [favoritesOnly, setFavoritesOnly] = useState(savedState.favoritesOnly || false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showVariablePopup, setShowVariablePopup] = useState(false)
  
  // References for keyboard shortcuts
  const searchRef = useRef(null) // Reference for focus on search (Ctrl+J)

  // Automatically save important preferences
  useEffect(() => {
    saveState({
      interfaceLanguage,
      templateLanguage,
      searchQuery,
      selectedCategory,
      variables,
      favorites,
      favoritesOnly
    })
  }, [interfaceLanguage, templateLanguage, searchQuery, selectedCategory, variables, favorites, favoritesOnly])

  // Interface texts by language
  const interfaceTexts = {
    fr: {
      title: 'Assistant pour rédaction de courriels aux clients',
      subtitle: 'Bureau de la traduction',
      selectTemplate: 'Sélectionnez un modèle',
      templatesCount: `modèles disponibles`,
      searchPlaceholder: '🔍 Rechercher un modèle...',
      allCategories: 'Toutes les catégories',
      categories: {
        'Devis et estimations': 'Devis et estimations',
        'Gestion de projets': 'Gestion de projets', 
        'Problèmes techniques': 'Problèmes techniques',
        'Communications générales': 'Communications générales',
        'Services spécialisés': 'Services spécialisés'
      },
      templateLanguage: 'Langue du modèle:',
      interfaceLanguage: 'Langue de l\'interface:',
      variables: 'Variables',
      editEmail: 'Éditez votre courriel',
      subject: 'Objet',
      body: 'Corps du message',
      reset: 'Réinitialiser',
      copy: 'Copier',
      copySubject: 'Copier Objet',
      copyBody: 'Copier Corps', 
      copyAll: 'Copier Tout',
      copied: 'Copié !',
  copyLink: 'Copier le lien',
  copyLinkTitle: 'Copier le lien direct vers ce modèle',
      noTemplate: 'Sélectionnez un modèle pour commencer',
      resetWarningTitle: 'Confirmer la réinitialisation',
      resetWarningMessage: 'Êtes-vous sûr de vouloir réinitialiser toutes les variables ? Cette action ne peut pas être annulée.',
      cancel: 'Annuler',
      confirm: 'Confirmer'
    },
    en: {
      title: 'Email Writing Assistant for Clients',
      subtitle: 'Translation Bureau',
      selectTemplate: 'Select a template',
      templatesCount: `templates available`,
      searchPlaceholder: '🔍 Search for a template...',
      allCategories: 'All categories',
      categories: {
        'Devis et estimations': 'Quotes and estimates',
        'Gestion de projets': 'Project management', 
        'Problèmes techniques': 'Technical issues',
        'Communications générales': 'General communications',
        'Services spécialisés': 'Specialized services'
      },
      templateLanguage: 'Template language:',
      interfaceLanguage: 'Interface language:',
      variables: 'Variables',
      editEmail: 'Edit your email',
      subject: 'Subject',
      body: 'Message body',
      reset: 'Reset',
      copy: 'Copy',
      copySubject: 'Copy Subject',
      copyBody: 'Copy Body',
      copyAll: 'Copy All',
      copied: 'Copied!',
  copyLink: 'Copy link',
  copyLinkTitle: 'Copy direct link to this template',
      noTemplate: 'Select a template to get started',
      resetWarningTitle: 'Confirm Reset',
      resetWarningMessage: 'Are you sure you want to reset all variables? This action cannot be undone.',
      cancel: 'Cancel',
      confirm: 'Confirm'
    }
  }

  const t = interfaceTexts[interfaceLanguage]

  // Load template data on startup
  useEffect(() => {
    const loadTemplatesData = async () => {
      try {
        if (debug) console.log('[EA][Debug] Fetching templates (with prod raw GitHub fallback)...')
        const REPO_RAW_URL = 'https://raw.githubusercontent.com/snarky1980/email-assistant-v6/main/complete_email_templates.json'
        const LOCAL_URL = './complete_email_templates.json'
        const isLocal = /^(localhost|127\.|0\.0\.0\.0)/i.test(window.location.hostname)
        const ts = Date.now()
        const withBust = (u) => u + (u.includes('?') ? '&' : '?') + 'cb=' + ts
        const candidates = isLocal
          ? [withBust(LOCAL_URL), withBust(REPO_RAW_URL)]
          : [withBust(REPO_RAW_URL), withBust(LOCAL_URL)]

        let loaded = null
        let lastErr = null
        for (const url of candidates) {
          try {
            if (debug) console.log('[EA][Debug] Try fetch', url)
            const resp = await fetch(url, { cache: 'no-cache' })
            if (!resp.ok) throw new Error('HTTP ' + resp.status)
            const j = await resp.json()
            loaded = j
            break
          } catch (e) {
            lastErr = e
            if (debug) console.warn('[EA][Debug] fetch candidate failed', url, e?.message || e)
          }
        }
        if (!loaded) throw lastErr || new Error('No template source reachable')
        setTemplatesData(loaded)
        if (debug) console.log('[EA][Debug] Templates loaded:', loaded.templates?.length)
      } catch (error) {
        console.error('Error loading templates data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadTemplatesData()
  }, [])

  // Auto-select first template once data is available
  useEffect(() => {
    if (!loading && templatesData && !selectedTemplate && Array.isArray(templatesData.templates) && templatesData.templates.length > 0) {
      if (debug) console.log('[EA][Debug] Auto-selecting first template')
      setSelectedTemplate(templatesData.templates[0])
    }
  }, [loading, templatesData, selectedTemplate, debug])

  /**
   * URL PARAMETER SUPPORT FOR DEEP LINK SHARING
   */
  useEffect(() => {
    if (!templatesData) return
    
    // Read current URL parameters
    const params = new URLSearchParams(window.location.search)
    const templateId = params.get('id')
    const langParam = params.get('lang')
    
    // Apply language from URL if specified and valid
    if (langParam && ['fr', 'en'].includes(langParam)) {
      setTemplateLanguage(langParam)
      setInterfaceLanguage(langParam)
    }
    
    // Pre-select template from URL
    if (templateId) {
      const template = templatesData.templates.find(t => t.id === templateId)
      if (template) {
        setSelectedTemplate(template)
      }
    }
  }, [templatesData]) // Triggers when templates are loaded

  /**
   * KEYBOARD SHORTCUTS FOR PROFESSIONAL UX
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + Enter: Copy all (main quick action)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (selectedTemplate) {
          copyToClipboard('all')
        }
      }
      
      // Ctrl/Cmd + B: Copy body only (Body)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        if (selectedTemplate) {
          copyToClipboard('body')
        }
      }
      
      // Ctrl/Cmd + J: Focus on search (Jump to search)
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault()
        if (searchRef.current) {
          searchRef.current.focus()
        }
      }
    }

    // Attach keyboard events globally
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedTemplate]) // Re-bind when template changes

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    if (!templatesData) return []
    let filtered = templatesData.templates

    if (searchQuery) {
      filtered = filtered.filter(template => 
        template.title[templateLanguage]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description[templateLanguage]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory)
    }

    if (favoritesOnly) {
      const favSet = new Set(favorites)
      filtered = filtered.filter(t => favSet.has(t.id))
    }

    return filtered
  }, [templatesData, searchQuery, selectedCategory, templateLanguage, favoritesOnly, favorites])

  // Get unique categories
  const categories = useMemo(() => {
    if (!templatesData) return []
    const cats = [...new Set(templatesData.templates.map(t => t.category))]
    return cats
  }, [templatesData])

  const isFav = (id) => favorites.includes(id)
  const toggleFav = (id) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Replace variables in text
  const replaceVariables = (text) => {
    let result = text
    Object.entries(variables).forEach(([varName, value]) => {
      const regex = new RegExp(`<<${varName}>>`, 'g')
      result = result.replace(regex, value || `<<${varName}>>`)
    })
    return result
  }

  // Load a selected template
  useEffect(() => {
    if (selectedTemplate) {
      // Initialize variables with default values
      const initialVars = {}
      selectedTemplate.variables.forEach(varName => {
        const varInfo = templatesData.variables[varName]
        if (varInfo) {
          initialVars[varName] = varInfo.example || ''
        }
      })
      setVariables(initialVars)
      
      // Update final versions with replaced variables
      const subjectWithVars = replaceVariables(selectedTemplate.subject[templateLanguage] || '')
      const bodyWithVars = replaceVariables(selectedTemplate.body[templateLanguage] || '')
      setFinalSubject(subjectWithVars)
      setFinalBody(bodyWithVars)
    }
  }, [selectedTemplate, templateLanguage])

  // Update final versions when variables change
  useEffect(() => {
    if (selectedTemplate) {
      const subjectWithVars = replaceVariables(selectedTemplate.subject[templateLanguage] || '')
      const bodyWithVars = replaceVariables(selectedTemplate.body[templateLanguage] || '')
      setFinalSubject(subjectWithVars)
      setFinalBody(bodyWithVars)
    }
  }, [variables, selectedTemplate, templateLanguage])

  /**
   * GRANULAR COPY FUNCTION
   */
  const copyToClipboard = async (type = 'all') => {
    let content = ''
    
    // Content selection based on requested type
    switch (type) {
      case 'subject':
        content = finalSubject
        break
      case 'body':
        content = finalBody
        break
      case 'all':
      default:
        content = `${finalSubject}\n\n${finalBody}`
        break
    }
    
    try {
      // Modern and secure method (HTTPS required)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content)
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea')
        textArea.value = content
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      
      // Visual success feedback (2 seconds)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Copy error:', error)
      // Error handling with user message
      alert('Copy error. Please select the text manually and use Ctrl+C.')
    }
  }

  /**
   * DIRECT LINK COPY FUNCTION
   */
  const copyTemplateLink = async () => {
    if (!selectedTemplate) return
    
    // Build full URL with parameters
    const currentUrl = window.location.origin + window.location.pathname
    const templateUrl = `${currentUrl}?id=${selectedTemplate.id}&lang=${templateLanguage}`
    
    try {
      // Copy URL to clipboard
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(templateUrl)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = templateUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      
      // Temporary visual feedback
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Link copy error:', error)
      alert('Link copy error. Please copy the URL manually from the address bar.')
    }
  }

  // Reset form with confirmation
  const [showResetWarning, setShowResetWarning] = useState(false)
  
  const handleResetClick = () => {
    setShowResetWarning(true)
  }

  const confirmReset = () => {
    if (selectedTemplate) {
      const initialVars = {}
      selectedTemplate.variables.forEach(varName => {
        const varInfo = templatesData.variables[varName]
        if (varInfo) {
          initialVars[varName] = varInfo.example || ''
        }
      })
      setVariables(initialVars)
      
      const subjectWithVars = replaceVariables(selectedTemplate.subject[templateLanguage] || '')
      const bodyWithVars = replaceVariables(selectedTemplate.body[templateLanguage] || '')
      setFinalSubject(subjectWithVars)
      setFinalBody(bodyWithVars)
    }
    setShowResetWarning(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50">
      {debug && (
        <div style={{ position: 'fixed', bottom: 8, left: 8, background: '#1e293b', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 12, zIndex: 9999, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          <div style={{ fontWeight: 600 }}>Debug</div>
          <div>loading: {String(loading)}</div>
          <div>templates: {templatesData?.templates?.length || 0}</div>
          <div>selected: {selectedTemplate?.id || 'none'}</div>
          <div>vars: {Object.keys(variables || {}).length}</div>
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des modèles...</p>
          </div>
        </div>
      ) : (
        <>
      {/* Dynamic header with EXACT teal/sage styling */}
      <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Mail className="h-10 w-10 text-white animate-pulse" />
                <Sparkles className="h-4 w-4 text-yellow-300 absolute -top-1 -right-1 animate-bounce" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white drop-shadow-lg">{t.title}</h1>
                <p className="text-emerald-100 text-sm">{t.subtitle}</p>
              </div>
            </div>
            
            {/* Interface language with modern style */}
            <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
              <Globe className="h-5 w-5 text-white" />
              <span className="text-white font-medium">{t.interfaceLanguage}:</span>
              <div className="flex bg-white/20 rounded-lg p-1">
                <button
                  onClick={() => setInterfaceLanguage('fr')}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-all duration-300 ${
                    interfaceLanguage === 'fr'
                      ? 'bg-white text-emerald-600 shadow-lg transform scale-105'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  FR
                </button>
                <button
                  onClick={() => setInterfaceLanguage('en')}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-all duration-300 ${
                    interfaceLanguage === 'en'
                      ? 'bg-white text-emerald-600 shadow-lg transform scale-105'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content with 4-column layout from original */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left panel - Template list */}
          <div className="lg:col-span-1">
            <Card className="h-fit shadow-xl border-0 bg-gradient-to-br from-white to-emerald-50 overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-emerald-50 to-teal-50">
                <CardTitle className="text-xl font-bold text-gray-800 flex items-center">
                  <FileText className="h-6 w-6 mr-2 text-emerald-600" />
                  {t.selectTemplate}
                </CardTitle>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">{filteredTemplates.length} {t.templatesCount}</p>
                  <button
                    onClick={() => setFavoritesOnly(v => !v)}
                    className={`text-xs px-2 py-1 rounded border ${favoritesOnly ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    title="Show only favorites"
                  >★ Favorites</button>
                </div>
                
                {/* Category filter with style */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="border-2 border-emerald-200 focus:border-emerald-400 transition-all duration-300">
                    <Filter className="h-4 w-4 mr-2 text-emerald-500" />
                    <SelectValue placeholder={t.allCategories} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.allCategories}</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {t.categories[category] || category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Search with clear button */}
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                    <Input
                      ref={searchRef}
                      type="text"
                      placeholder={t.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10 border-2 border-teal-200 focus:border-teal-400 focus:ring-4 focus:ring-teal-100 transition-all duration-300"
                    />
                    {/* Clear search button */}
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Clear search"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                </div>

                {/* Template language with modern style */}
                <div className="flex items-center space-x-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg p-3">
                  <Languages className="h-5 w-5 text-teal-600" />
                  <span className="text-sm font-semibold text-gray-700">{t.templateLanguage}:</span>
                  <div className="flex bg-white rounded-lg p-1 shadow-sm">
                    <button
                      onClick={() => setTemplateLanguage('fr')}
                      className={`px-3 py-1 text-sm font-bold rounded-md transition-all duration-300 ${
                        templateLanguage === 'fr'
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg transform scale-105'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      FR
                    </button>
                    <button
                      onClick={() => setTemplateLanguage('en')}
                      className={`px-3 py-1 text-sm font-bold rounded-md transition-all duration-300 ${
                        templateLanguage === 'en'
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg transform scale-105'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      EN
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="h-[600px]" style={{ '--scrollbar-width': '8px' }}>
                  <div className="space-y-3 p-4 relative">
                    {/* Scroll indicator at bottom */}
                    {filteredTemplates.length > 6 && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10 flex items-end justify-center pb-1">
                        <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full shadow-sm border">
                          ↓ {filteredTemplates.length - 6}+ more templates
                        </div>
                      </div>
                    )}
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-102 ${
                          selectedTemplate?.id === template.id
                            ? 'border-emerald-400 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-lg transform scale-102'
                            : 'border-gray-200 hover:border-emerald-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 text-sm mb-1">
                              {template.title[templateLanguage]}
                            </h3>
                            <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                              {template.description[templateLanguage]}
                            </p>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs font-medium ${
                                template.category === 'Devis et estimations' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                template.category === 'Gestion de projets' ? 'bg-green-100 text-green-700 border-green-200' :
                                template.category === 'Problèmes techniques' ? 'bg-red-100 text-red-700 border-red-200' :
                                template.category === 'Communications générales' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                template.category === 'Services spécialisés' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                'bg-gray-100 text-gray-700 border-gray-200'
                              }`}
                            >
                              {template.category}
                            </Badge>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFav(template.id) }}
                            className={`ml-3 text-lg ${isFav(template.id) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                            title={isFav(template.id) ? 'Unfavorite' : 'Favorite'}
                            aria-label="Toggle favorite"
                          >★</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right panel - Editing (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            {selectedTemplate ? (
              <>
                {/* Editable version - MAIN AREA */}
                <Card className="shadow-2xl border-0 bg-gradient-to-br from-white to-emerald-50 overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50">
                    <CardTitle className="text-2xl font-bold text-gray-800 flex items-center justify-between">
                      <div className="flex items-center">
                        <Mail className="h-7 w-7 mr-3 text-emerald-600" />
                        {t.editEmail}
                      </div>
                      {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                        <Button
                          onClick={() => setShowVariablePopup(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                          size="sm"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {t.variables}
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">


                    {/* Editable subject with preview highlighting */}
                    <div className="space-y-3">
                      <label className="text-lg font-bold text-gray-700 flex items-center">
                        <span className="w-3 h-3 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                        {t.subject}
                      </label>
                      <HighlightingEditor
                        value={finalSubject}
                        onChange={(e) => setFinalSubject(e.target.value)}
                        variables={variables}
                        placeholder={t.subject}
                        minHeight="60px"
                      />

                    </div>

                    {/* Editable body with preview highlighting */}
                    <div className="space-y-3">
                      <label className="text-lg font-bold text-gray-700 flex items-center">
                        <span className="w-3 h-3 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                        {t.body}
                      </label>
                      <HighlightingEditor
                        value={finalBody}
                        onChange={(e) => setFinalBody(e.target.value)}
                        variables={variables}
                        placeholder={t.body}
                        minHeight="250px"
                      />

                    </div>
                  </CardContent>
                </Card>

                {/* Actions with modern style */}
                <div className="flex justify-between items-center">
                  {/* Copy link button - Discrete on left */}
                  <Button 
                    variant="ghost" 
                    onClick={() => copyTemplateLink()}
                    className="text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-300 font-medium text-sm"
                    title={t.copyLinkTitle}
                  >
                    <Link className="h-4 w-4 mr-2" />
                    {t.copyLink}
                  </Button>
                  
                  <div className="flex space-x-4">
                    <Button 
                      variant="outline" 
                      onClick={handleResetClick}
                      className="border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 font-semibold"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {t.reset}
                    </Button>
                  
                  {/* 
                    GRANULAR COPY BUTTONS - ENHANCED UX
                  */}
                  <div className="flex space-x-2">
                    {/* Subject Copy Button - Blue (email associated) */}
                    <Button 
                      onClick={() => copyToClipboard('subject')} 
                      variant="outline"
                      className="font-medium px-4 py-2 border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-all duration-300 group"
                      title="Copy subject only (Ctrl+J)"
                    >
                      <Mail className="h-4 w-4 mr-2 group-hover:text-blue-600" />
                      {t.copySubject || 'Subject'}
                    </Button>
                    
                    {/* Body Copy Button - Green (content associated) */}
                    <Button 
                      onClick={() => copyToClipboard('body')} 
                      variant="outline"
                      className="font-medium px-4 py-2 border-2 border-green-300 hover:border-green-500 hover:bg-green-50 transition-all duration-300 group"
                      title="Copy body only (Ctrl+B)"
                    >
                      <Edit3 className="h-4 w-4 mr-2 group-hover:text-green-600" />
                      {t.copyBody || 'Body'}
                    </Button>
                    
                    {/* Complete Copy Button - Gradient (main action) */}
                    <Button 
                      onClick={() => copyToClipboard('all')} 
                      className={`font-bold px-6 py-3 transition-all duration-300 shadow-lg ${
                        copySuccess 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transform scale-105' 
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:scale-105'
                      }`}
                      title="Copy entire email (Ctrl+Enter)"
                    >
                      <Copy className="h-5 w-5 mr-2" />
                      {copySuccess ? t.copied : (t.copyAll || 'All')}
                    </Button>
                  </div>
                  </div>
                </div>
              </>
            ) : (
              <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-emerald-50">
                <CardContent className="flex items-center justify-center h-80">
                  <div className="text-center">
                    <div className="relative mb-6">
                      <FileText className="h-16 w-16 text-gray-300 mx-auto animate-bounce" />
                      <Sparkles className="h-6 w-6 text-emerald-400 absolute -top-2 -right-2 animate-pulse" />
                    </div>
                    <p className="text-gray-500 text-lg font-medium">{t.noTemplate}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          {/* AI Sidebar - always visible on the right (1 column) */}
          <div className="lg:col-span-1">
            <AISidebar emailText={finalBody} onResult={setFinalBody} variables={variables} />
          </div>
        </div>
      </main>
        </>
      )}

      {/* Reset Warning Dialog */}
      {showResetWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t.resetWarningTitle}</h2>
              <p className="text-gray-600">{t.resetWarningMessage}</p>
            </div>
            <div className="flex space-x-4">
              <Button
                onClick={() => setShowResetWarning(false)}
                variant="outline"
                className="flex-1"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={confirmReset}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {t.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resizable Variables Popup */}
      {showVariablePopup && selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-xl shadow-2xl border border-gray-200 min-w-[500px] max-w-[800px] min-h-[400px] max-h-[80vh] overflow-hidden resizable-popup"
            style={{ 
              width: '600px',
              height: '500px'
            }}
          >
            {/* Popup Header */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center">
                <Edit3 className="h-6 w-6 mr-3 text-emerald-600" />
                <h2 className="text-xl font-bold text-gray-800">{t.variables}</h2>
                <Badge variant="outline" className="ml-3 text-xs">
                  {selectedTemplate.variables.length} variable{selectedTemplate.variables.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                  <Move className="h-3 w-3 mr-1" />
                  Resizable
                </div>
                <Button
                  onClick={() => setShowVariablePopup(false)}
                  variant="ghost"
                  size="sm"
                  className="hover:bg-red-100 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Popup Content - Scrollable */}
            <div className="p-6 overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedTemplate.variables.map((varName) => {
                  const varInfo = templatesData.variables[varName]
                  if (!varInfo) return null
                  
                  const currentValue = variables[varName] || ''
                  
                  // Color based on variable type
                  const getTypeColor = () => {
                    switch (varInfo.type) {
                      case 'email': return 'border-blue-300 focus:border-blue-500 focus:ring-blue-200'
                      case 'phone': return 'border-green-300 focus:border-green-500 focus:ring-green-200'
                      case 'date': return 'border-purple-300 focus:border-purple-500 focus:ring-purple-200'
                      case 'number': return 'border-orange-300 focus:border-orange-500 focus:ring-orange-200'
                      default: return 'border-gray-300 focus:border-gray-500 focus:ring-gray-200'
                    }
                  }
                  
                  return (
                    <div key={varName} className="bg-gradient-to-br from-white to-emerald-50 rounded-lg p-4 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all duration-200">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-gray-700 flex items-center">
                          <span className={`w-3 h-3 rounded-full mr-2 ${
                            varInfo.type === 'email' ? 'bg-blue-400' :
                            varInfo.type === 'phone' ? 'bg-green-400' :
                            varInfo.type === 'date' ? 'bg-purple-400' :
                            varInfo.type === 'number' ? 'bg-orange-400' :
                            'bg-gray-400'
                          }`}></span>
                          {varInfo.description[interfaceLanguage]}
                        </label>
                        
                        {/* Type badge */}
                        <Badge variant="outline" className={`text-xs font-medium ${
                          varInfo.type === 'email' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          varInfo.type === 'phone' ? 'bg-green-50 text-green-700 border-green-200' :
                          varInfo.type === 'date' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          varInfo.type === 'number' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {varInfo.type}
                        </Badge>
                      </div>
                      
                      {/* Input field */}
                      <Input
                        value={currentValue}
                        onChange={(e) => setVariables(prev => ({
                          ...prev,
                          [varName]: e.target.value
                        }))}
                        placeholder={varInfo.example}
                        className={`h-10 border-2 transition-all duration-200 ${getTypeColor()}`}
                      />
                      
                      {/* Example and counter */}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">
                          Ex: {varInfo.example}
                        </span>
                        {varInfo.type === 'text' && currentValue.length > 20 && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                            {currentValue.length} characters
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Footer info */}
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                <p className="text-sm text-emerald-800">
                  <span className="font-semibold">💡 Tip:</span> Changes are applied in real-time to your email.
                  You can resize this window by dragging the corners.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App