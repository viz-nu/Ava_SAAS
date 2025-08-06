import { Router } from "express";
import { authMiddleware, requireScope, requireAnyScope, requireResourceOwnership } from "../middleware/auth.js";
import { fetchTickets, updateTicket } from "../controllers/tickets/index.js";
import { Ticket } from "../models/Tickets.js";

export const ticketsRouter = Router()

// Ticket management operations with scope-based authorization
ticketsRouter.get('{/:id}', authMiddleware, requireScope('ticket:read'), fetchTickets);
ticketsRouter.patch('/:id', authMiddleware, requireScope('ticket:update'), requireResourceOwnership(Ticket, 'id'), updateTicket); 