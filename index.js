const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require('discord.js');

// Création du bot avec ses autorisations
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Map pour stocker les sessions de pointage en mémoire
const activeSessions = new Map();

// Configuration du bot
const PREFIX = "!"; 

// 🔄 REMETS TON TOKEN ENTIER ENTRE LES GUILLEMETS ICI :
const TOKEN = "MTUyMjAyODg2NTc4MDcxNTYzMQ.GnVbjG.Ptiaeb6d6U47ET0nsRYu54tTay-hg6qac0kVis"; 

client.once('ready', () => {
    console.log(`🤖 Bot connecté avec succès en tant que ${client.user.tag}!`);
});

// Écoute des messages pour lancer la pointeuse
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    // LIGNE 36 CORRIGÉE : Séparation correcte des arguments par espaces
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'pointeuse') {
        const embed = new EmbedBuilder()
            .setTitle("🕒 Système de Pointage")
            .setDescription("Bienvenue sur le système de gestion du temps de service.\nCliquez sur les boutons ci-dessous pour gérer votre session.")
            .setColor("#5865F2")
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_service')
                .setLabel('Début de service')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('pause_service')
                .setLabel('Pause / Reprise')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stop_service')
                .setLabel('Arrêt de service')
                .setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// Gestion des clics sur les boutons (Interactions)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;
    const session = activeSessions.get(userId);
    const now = Date.now();

    // 🟢 BOUTON : DÉBUT DE SERVICE
    if (interaction.customId === 'start_service') {
        if (session && session.status !== 'Terminé') {
            return interaction.reply({ content: "❌ Tu es déjà en service ou en pause !", ephemeral: true });
        }

        activeSessions.set(userId, {
            startTime: now,
            totalPauseTime: 0,
            pauseStartTime: null,
            status: 'En service'
        });

        const startEmbed = new EmbedBuilder()
            .setTitle("🏁 Service Commencé")
            .setColor("#57F287")
            .setDescription(`L'utilisateur <@${userId}> a pris son service.`)
            .addFields(
                { name: "👤 Employé", value: `<@${userId}>`, inline: true },
                { name: "⏰ Début", value: `<t:${Math.floor(now / 1000)}:T>`, inline: true },
                { name: "📊 Statut", value: "🟢 En service", inline: true }
            )
            .setTimestamp();

        return interaction.reply({ embeds: [startEmbed] });
    }

    // 🟡 BOUTON : PAUSE / REPRISE
    if (interaction.customId === 'pause_service') {
        if (!session || session.status === 'Terminé') {
            return interaction.reply({ content: "❌ Tu n'es pas en service. Clique d'abord sur 'Début de service'.", ephemeral: true });
        }

        if (session.status === 'En service') {
            // Passage en pause
            session.status = 'En pause';
            session.pauseStartTime = now;
            activeSessions.set(userId, session);

            const pauseEmbed = new EmbedBuilder()
                .setTitle("⏸️ Service en Pause")
                .setColor("#FEE75C")
                .setDescription(`<@${userId}> est parti en pause.`)
                .addFields(
                    { name: "👤 Employé", value: `<@${userId}>`, inline: true },
                    { name: "⏰ Pause débutée à", value: `<t:${Math.floor(now / 1000)}:T>`, inline: true },
                    { name: "📊 Statut", value: "🟡 En pause", inline: true }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [pauseEmbed] });

        } else if (session.status === 'En pause') {
            // Retour de pause
            const pauseDuration = now - session.pauseStartTime;
            session.totalPauseTime += pauseDuration;
            session.status = 'En service';
            session.pauseStartTime = null;
            activeSessions.set(userId, session);

            const resumeEmbed = new EmbedBuilder()
                .setTitle("▶️ Reprise du Service")
                .setColor("#57F287")
                .setDescription(`<@${userId}> est de retour de pause.`)
                .addFields(
                    { name: "👤 Employé", value: `<@${userId}>`, inline: true },
                    { name: "⏰ Reprise à", value: `<t:${Math.floor(now / 1000)}:T>`, inline: true },
                    { name: "📊 Statut", value: "🟢 En service", inline: true }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [resumeEmbed] });
        }
    }

    // 🔴 BOUTON : ARRÊT DE SERVICE
    if (interaction.customId === 'stop_service') {
        if (!session || session.status === 'Terminé') {
            return interaction.reply({ content: "❌ Tu n'es pas en service actuel !", ephemeral: true });
        }

        let finalPauseTime = session.totalPauseTime;
        // Si l'utilisateur clique sur stop alors qu'il était encore en pause
        if (session.status === 'En pause') {
            finalPauseTime += (now - session.pauseStartTime);
        }

        // Calcul du temps total de travail effectif
        const totalDurationMs = now - session.startTime - finalPauseTime;
        
        // Formatage en Heures / Minutes / Secondes
        const totalSeconds = Math.floor(totalDurationMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const timeString = `${hours}h ${minutes}m ${seconds}s`;

        const stopEmbed = new EmbedBuilder()
            .setTitle("🛑 Service Terminé")
            .setColor("#ED4245")
            .setDescription(`L'utilisateur <@${userId}> a fini son service.`)
            .addFields(
                { name: "👤 Employé", value: `<@${userId}>`, inline: false },
                { name: "⏰ Début", value: `<t:${Math.floor(session.startTime / 1000)}:T>`, inline: true },
                { name: "⏰ Fin", value: `<t:${Math.floor(now / 1000)}:T>`, inline: true },
                { name: "⏱️ Temps de travail effectif", value: `**${timeString}** (Excluant les pauses)`, inline: false }
            )
            .setTimestamp();

        // Supprimer la session de la mémoire après la fin
        activeSessions.delete(userId);

        return interaction.reply({ embeds: [stopEmbed] });
    }
});

client.login(TOKEN);
