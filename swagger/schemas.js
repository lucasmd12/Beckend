/**
 * @swagger
 * components:
 *   schemas:
 *     UserAdmin:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         username:
 *           type: string
 *         role:
 *           type: string
 *       example:
 *         _id: "665af18a2f4b9a001ea73b9a"
 *         username: "idcloned"
 *         role: "ADM"
 *
 *     ClanChatMessage:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da mensagem.
 *         clan:
 *           type: string
 *           description: ID do clã ao qual a mensagem pertence.
 *         sender:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             username:
 *               type: string
 *             avatar:
 *               type: string
 *         content:
 *           type: string
 *           description: Conteúdo da mensagem de texto.
 *         type:
 *           type: string
 *           description: Tipo de mensagem (text, image, file).
 *         fileUrl:
 *           type: string
 *           description: URL do arquivo, se o tipo não for texto.
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Data e hora do envio da mensagem.
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1d"
 *         clan: "60d5ec49f8c7b7001c8e4d1a"
 *         sender:
 *           _id: "60d5ec49f8c7b7001c8e4d1b"
 *           username: "player1"
 *           avatar: "https://example.com/avatar.png"
 *         content: "Olá a todos no clã!"
 *         type: "text"
 *         fileUrl: null
 *         timestamp: "2023-10-27T10:05:00Z"
 *
 *     FederationChatMessage:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único da mensagem.
 *         federation:
 *           type: string
 *           description: ID da federação à qual a mensagem pertence.
 *         sender:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             username:
 *               type: string
 *             avatar:
 *               type: string
 *         content:
 *           type: string
 *           description: Conteúdo da mensagem de texto.
 *         type:
 *           type: string
 *           description: Tipo de mensagem (text, image, file).
 *         fileUrl:
 *           type: string
 *           description: URL do arquivo, se o tipo não for texto.
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Data e hora do envio da mensagem.
 *       example:
 *         _id: "60d5ec49f8c7b7001c8e4d1e"
 *         federation: "60d5ec49f8c7b7001c8e4d1f"
 *         sender:
 *           _id: "60d5ec49f8c7b7001c8e4d20"
 *           username: "federation_leader"
 *           avatar: "https://example.com/avatar2.png"
 *         content: "Saudações, membros da federação!"
 *         type: "text"
 *         fileUrl: null
 *         timestamp: "2023-10-27T10:10:00Z"
 */


