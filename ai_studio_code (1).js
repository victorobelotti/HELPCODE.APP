/**
 * Script principal para a página de solicitação HelpCode.
 * Gerencia a navegação entre etapas, geolocalização, gravação de áudio e submissão do formulário.
 *
 * @author HelpCode Team
 * @version 2.0.0 Refatorado
 */
document.addEventListener('DOMContentLoaded', () => {

    // ====================================================================================
    // CONFIGURAÇÃO E CONSTANTES
    // ====================================================================================

    // URL de Ação do Google Forms
    const GOOGLE_FORM_ACTION_URL = "https://docs.google.com/forms/d/e/1FAIpQLScnL18rvuEb9bshVPOWLatAY7llz8fCkWnz1APrcwmGcKGjEw/formResponse";

    // Mapeamento dos IDs dos campos do Google Forms
    const FORM_ENTRY_IDS = {
        TIPO_APOIO: 'entry.1944720991',
        LOCALIZACAO: 'entry.1072432796',
        MOTIVO: 'entry.549038910',
        TELEFONE: 'entry.111803321',
        DEFICIENCIA: 'entry.308908157',
        DETALHES_DEFICIENCIA: 'entry.22088114',
        AUDIO_FLAG: 'entry.512796803'
    };
    
    // Constantes de Mensagens para o Usuário
    const MESSAGES = {
        SUCCESS: 'Seu pedido foi enviado com sucesso!',
        ERROR: 'Erro ao enviar. Verifique sua conexão e tente novamente.',
        SENDING: 'Enviando, por favor aguarde...',
        LOCATION_FETCHING: 'Obtendo localização...',
        LOCATION_UNSUPPORTED: 'Geolocalização não suportada pelo seu navegador.'
    };

    // Seletores do DOM
    const UI = {
        step1: document.getElementById('step1'),
        helpForm: document.getElementById('helpForm'),
        backToStep1Btn: document.getElementById('back-to-step1'),
        optionBtns: document.querySelectorAll('.option-btn'),
        tipoApoioInput: document.getElementById('tipoApoio'),
        tipoApoioDisplay: document.getElementById('tipoApoioDisplay'),
        getLocationBtn: document.getElementById('getLocationBtn'),
        localizacaoTextarea: document.getElementById('localizacao'),
        deficienciaSim: document.getElementById('deficienciaSim'),
        deficienciaNao: document.getElementById('deficienciaNao'),
        deficienciaDetalhes: document.getElementById('deficienciaDetalhes'),
        outrasDeficienciaCheckbox: document.getElementById('deficienciaOutras'),
        outrasDeficienciaText: document.getElementById('outrasDeficienciaText'),
        confirmationMessage: document.getElementById('confirmationMessage'),
        headerLogo: document.getElementById('headerLogo'),
        submitBtn: document.getElementById('submitBtn'),
        recordButton: document.getElementById('recordButton'),
        stopButton: document.getElementById('stopButton'),
        deleteButton: document.getElementById('deleteButton'),
        audioStatus: document.getElementById('audioStatus'),
        audioPlayerContainer: document.querySelector('.audio-player-container'),
        audioPlayer: document.getElementById('audioPlayer')
    };

    let mediaRecorder;
    let audioChunks = [];
    let audioBlob = null;
    
    // ====================================================================================
    // MÓDULO DE INICIALIZAÇÃO E UI
    // ====================================================================================

    /**
     * Inicializa a lógica do logotipo da empresa a partir de um parâmetro de URL.
     */
    function initializeLogo() {
        const getUrlParameter = (name) => {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            const regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
            const results = regex.exec(location.search);
            return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
        };
        const companyLogoUrl = getUrlParameter('logo');
        const logoImg = document.createElement('img');
        logoImg.src = companyLogoUrl || "https://i.ibb.co/C07p9T0/logo-helpcode.png";
        logoImg.alt = companyLogoUrl ? "Logo da Empresa" : "HelpCode Logo";
        logoImg.classList.add('header-logo');
        UI.headerLogo.appendChild(logoImg);
    }

    /**
     * Exibe uma mensagem de confirmação/erro ao usuário.
     * @param {string} text - O texto da mensagem.
     * @param {'success'|'error'} type - O tipo de mensagem.
     */
    function showConfirmationMessage(text, type) {
        UI.confirmationMessage.textContent = text;
        UI.confirmationMessage.className = type;
        UI.confirmationMessage.classList.remove('hidden');
    }

    /**
     * Alterna a visibilidade entre a Etapa 1 e o Formulário.
     * @param {boolean} showForm - True para mostrar o formulário, false para mostrar a Etapa 1.
     */
    function toggleSteps(showForm) {
        UI.step1.classList.toggle('hidden', showForm);
        UI.helpForm.classList.toggle('hidden', !showForm);
    }
    
    // ====================================================================================
    // MÓDULO DE MANIPULAÇÃO DE EVENTOS
    // ====================================================================================
    
    function setupEventListeners() {
        // Navegação: Selecionar tipo de apoio
        UI.optionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                UI.tipoApoioInput.value = btn.dataset.value;
                UI.tipoApoioDisplay.value = btn.textContent;
                toggleSteps(true);
            });
        });

        // Navegação: Botão Voltar
        UI.backToStep1Btn.addEventListener('click', () => toggleSteps(false));

        // Lógica de Deficiência
        UI.deficienciaSim.addEventListener('change', () => UI.deficienciaDetalhes.classList.remove('hidden'));
        UI.deficienciaNao.addEventListener('change', () => UI.deficienciaDetalhes.classList.add('hidden'));
        UI.outrasDeficienciaCheckbox.addEventListener('change', () => UI.outrasDeficienciaText.classList.toggle('hidden', !UI.outrasDeficienciaCheckbox.checked));

        // Lógica de Geolocalização
        UI.getLocationBtn.addEventListener('click', () => {
            UI.localizacaoTextarea.value = MESSAGES.LOCATION_FETCHING;
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    pos => UI.localizacaoTextarea.value = `Lat: ${pos.coords.latitude}, Lon: ${pos.coords.longitude}`,
                    () => UI.localizacaoTextarea.value = 'Não foi possível obter a localização.'
                );
            } else {
                UI.localizacaoTextarea.value = MESSAGES.LOCATION_UNSUPPORTED;
            }
        });

        // Lógica de Áudio
        UI.recordButton.addEventListener('click', startRecording);
        UI.stopButton.addEventListener('click', stopRecording);
        UI.deleteButton.addEventListener('click', deleteRecording);

        // Submissão do Formulário
        UI.helpForm.addEventListener('submit', handleFormSubmit);
    }
    
    // ====================================================================================
    // MÓDULO DE GRAVAÇÃO DE ÁUDIO
    // ====================================================================================

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                UI.audioStatus.textContent = 'Áudio gravado. Ouça ou apague.';
                UI.recordButton.disabled = true;
                UI.stopButton.disabled = true;
                UI.deleteButton.disabled = false;
                UI.audioPlayer.src = URL.createObjectURL(audioBlob);
                UI.audioPlayerContainer.classList.remove('hidden');
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            UI.audioStatus.textContent = 'Gravando...';
            UI.recordButton.disabled = true;
            UI.stopButton.disabled = false;
            UI.deleteButton.disabled = true;
        } catch (err) {
            UI.audioStatus.textContent = 'Permissão de microfone negada.';
            console.error("Erro ao acessar microfone:", err);
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
    }

    function deleteRecording() {
        audioBlob = null;
        UI.audioStatus.textContent = '';
        UI.audioPlayer.src = '';
        UI.audioPlayerContainer.classList.add('hidden');
        UI.recordButton.disabled = false;
        UI.deleteButton.disabled = true;
        UI.stopButton.disabled = true;
    }

    // ====================================================================================
    // MÓDULO DE SUBMISSÃO DO FORMULÁRIO
    // ====================================================================================

    /**
     * Manipula o evento de submissão do formulário, validando e enviando os dados.
     * @param {Event} e - O objeto do evento de submissão.
     */
    async function handleFormSubmit(e) {
        e.preventDefault();

        // Melhoria: Validação antes do envio
        if (!UI.helpForm.checkValidity()) {
            showConfirmationMessage('Por favor, preencha todos os campos obrigatórios (*).', 'error');
            // Força o navegador a mostrar quais campos são inválidos
            UI.helpForm.reportValidity();
            return;
        }

        // Melhoria: Feedback de "Enviando..."
        UI.submitBtn.disabled = true;
        UI.submitBtn.textContent = MESSAGES.SENDING;
        UI.confirmationMessage.classList.add('hidden');

        const formData = buildFormData();

        try {
            await fetch(GOOGLE_FORM_ACTION_URL, {
                method: 'POST',
                body: formData,
                mode: 'no-cors'
            });

            showConfirmationMessage(MESSAGES.SUCCESS, 'success');
            UI.helpForm.reset();
            deleteRecording(); // Limpa o áudio após o envio
            toggleSteps(false); // Volta para a tela inicial

        } catch (error) {
            console.error('Form submission error:', error);
            showConfirmationMessage(MESSAGES.ERROR, 'error');
        } finally {
            // Reabilita o botão em caso de sucesso ou erro
            UI.submitBtn.disabled = false;
            UI.submitBtn.textContent = 'Enviar Solicitação';
        }
    }
    
    /**
     * Constrói o objeto FormData com os dados do formulário.
     * @returns {FormData} O objeto FormData pronto para ser enviado.
     */
    function buildFormData() {
        const googleFormData = new FormData();
        
        googleFormData.append(FORM_ENTRY_IDS.TIPO_APOIO, UI.tipoApoioInput.value);
        googleFormData.append(FORM_ENTRY_IDS.LOCALIZACAO, UI.localizacaoTextarea.value);
        googleFormData.append(FORM_ENTRY_IDS.MOTIVO, UI.helpForm.motivo.value);
        googleFormData.append(FORM_ENTRY_IDS.TELEFONE, UI.helpForm.telefone.value);
        googleFormData.append(FORM_ENTRY_IDS.DEFICIENCIA, UI.deficienciaSim.checked ? 'Sim' : 'Não');

        if (UI.deficienciaSim.checked) {
            const defs = Array.from(document.querySelectorAll('input[name="deficienciaDetalhe"]:checked'))
                              .map(cb => cb.value);
            const outrasDetalhes = document.getElementById('outrasDeficiencia').value.trim();
            if (outrasDetalhes) {
                defs.push(`Outras: ${outrasDetalhes}`);
            }
            googleFormData.append(FORM_ENTRY_IDS.DETALHES_DEFICIENCIA, defs.length > 0 ? defs.join(', ') : 'Nenhuma especificada');
        } else {
            googleFormData.append(FORM_ENTRY_IDS.DETALHES_DEFICIENCIA, 'Não se aplica');
        }

        googleFormData.append(FORM_ENTRY_IDS.AUDIO_FLAG, audioBlob ? 'ÁUDIO GRAVADO' : 'NÃO GRAVADO');
        
        return googleFormData;
    }
    
    // ====================================================================================
    // PONTO DE ENTRADA DA APLICAÇÃO
    // ====================================================================================
    function init() {
        initializeLogo();
        setupEventListeners();
    }

    init();
});