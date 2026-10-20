# NIIP — Espaço da equipe

Site responsivo para Núcleo de Informática e Inspeção de POPs. JavaScript nativo, sem build ou dependências locais. Backend preparado para Firebase Authentication (e-mail/senha) e Cloud Firestore. Hospedagem preparada para Vercel.

## Estado desta entrega

Código implementado e repositório Git local inicializado. Não foi criado um repositório remoto, não houve publicação na Vercel e nenhum projeto Firebase foi criado ou alterado. As contas não foram conectadas. A aplicação inicia em demonstração local, vazia e explicitamente identificada. Registros da demonstração não são enviados ao Firebase quando a integração é ativada.

## Funcionalidades

- Criar, editar, concluir, reabrir e excluir lembretes e anotações.
- POP/setor, responsável, descrição, prioridade e prazo por registro.
- Mural, filtros, busca e contadores de pendências, atrasos e concluídos.
- Layout para computador e celular.
- Login e sincronização em tempo real implementados, dependentes de configuração.
- Controle de acesso por lista de membros no Firestore. Todos os membros ativos podem editar/excluir os registros da equipe. Não há cadastro público.
- Lembretes no painel: não há push, e-mail nem execução em segundo plano.

## Visualizar localmente

Na raiz deste projeto execute `python3 -m http.server 8080 --directory public` e abra http://localhost:8080. Sem configurar Firebase, os dados ficam somente no navegador. Não use a demonstração para informações operacionais sensíveis em computador compartilhado.

## Configurar Firebase

1. No console Firebase, escolha/crie o projeto destinado ao NIIP e registre um aplicativo Web.
2. Crie Cloud Firestore no modo de produção, escolhendo a região apropriada. Publique o conteúdo de `firestore.rules` na aba Regras antes de utilizar o sistema.
3. Ative Authentication > E-mail/senha. Cadastre as contas da equipe pelo console, conforme seu processo interno de acesso.
4. Para cada usuário, copie seu UID em Authentication e crie `members/{UID}` no Firestore com o campo booleano `active: true`. Para revogar o acesso, altere para false. As regras não permitem que usuários se adicionem à equipe.
5. Copie o objeto de configuração pública do app Web para `public/config.js`: `window.NIIP_CONFIG = { firebase: { apiKey: '...', authDomain: '...', projectId: '...', appId: '...' } };`. Copie os valores exatos do console; não use credenciais de conta de serviço.
6. Inclua o domínio de produção em Authentication > Configurações > Domínios autorizados quando necessário ao fluxo de autenticação.
7. Teste com dois membros, um usuário não autorizado e uma sessão sem login. Valide que dois membros veem a mesma criação/edição/exclusão e que terceiros recebem acesso negado. Teste também a revogação de um membro.

SDK modular oficial carregado pelo CDN Firebase na versão 13.0.0, conforme documentação consultada em 19/10/2026. Dependência de rede para login e operações compartilhadas.

## GitHub e Vercel

1. Crie um repositório **privado** chamado `niip-equipe` na conta/organização escolhida. Não inclua README automático se for enviar este histórico local.
2. Extraia o ZIP (inclui um repositório Git local), entre na pasta e execute `git remote add origin URL_DO_SEU_REPOSITORIO` e `git push -u origin main`. Autentique-se pelos fluxos oficiais, sem compartilhar tokens no chat.
3. Na Vercel, importe esse repositório. Use o preset Other, sem comando de build, diretório de saída `public`; o `vercel.json` também define esse diretório.
4. Publique após configurar Firebase. Sem isso a publicação será apenas uma demonstração local, sem colaboração.

## Validação e limites

A sintaxe JavaScript foi verificada localmente. Testes reais de autenticação, regras no emulador, sincronização entre contas e implantação ainda precisam ser realizados no ambiente configurado. A versão atual aplica a última alteração recebida a cada campo editado; não oferece edição colaborativa simultânea de texto, histórico completo ou notificações externas. Dados ficam no Firestore em produção, sem modo offline persistente configurado. Recomenda-se validar regras no emulador antes do uso operacional.

Fontes técnicas:
- https://firebase.google.com/docs/web/alt-setup
- https://firebase.google.com/docs/firestore/security/rules-conditions

## Configuração do Firebase (login e dados compartilhados)

1. Em Firebase Console > Authentication > Método de login, ative **E-mail/senha**.
2. Em Authentication > Usuários, crie cada conta autorizada.
3. Para cada usuário, copie o UID exibido em Authentication > Usuários.
4. Em Firestore Database, crie um documento na coleção `members` com o **ID do documento igual ao UID** desse usuário e o campo `active` do tipo booleano com valor `true`.
5. Publique as regras de `firestore.rules` no Firestore (ou use Firebase CLI para publicar o arquivo).
6. `public/config.js` contém a configuração pública do app Web. Não coloque chaves de conta de serviço ou credenciais administrativas nesse arquivo.

As regras atuais restringem leitura e escrita de `records` a usuários autenticados que tenham documento ativo em `members`. A coleção `members` não pode ser alterada pelo site.
