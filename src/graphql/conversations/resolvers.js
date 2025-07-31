// export const conversationResolvers = {
//   Query: {
//     movies: (_, args, context, info) => {
//       // implement logic
//       return []; // or actual result
//     },
//     movie: (_, { id }) => {
//       // implement logic
//       return null;
//     }
//   },
//   Mutation: {
//     addMovie: (_, { movie }) => {
//       // implement logic
//       return movie;
//     },
//     updateMovie: (_, { id, movie }) => {
//       return movie;
//     },
//     deleteMovie: (_, { id }) => true,
//     addReview: (_, { review }) => review,
//     updateReview: (_, { id, review }) => review,
//     deleteReview: (_, { id }) => true,
//   },
// };

import { fetchConversations } from "./controlers.js";


export const conversationResolvers = {
  Query: {
    conversations: async (_, filters, context, info) => await fetchConversations(_,filters, context, info),
  },
  // Mutation: {
  //   addConversation: async (_, { conversation }) => {
  //     const newConversation = new Conversation(conversation);
  //     await newConversation.save();
  //     return newConversation;
  //   },
  //   updateConversation: async (_, { id, conversation }) => {
  //     return await Conversation.findByIdAndUpdate(id, conversation, { new: true });
  //   },
  //   deleteConversation: async (_, { id }) => {
  //     const result = await Conversation.findByIdAndDelete(id);
  //     return !!result;
  //   }
  // }
};
