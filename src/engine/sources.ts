/**
 * The research every parameter leans on. Ids are used in params.ts and shown
 * in the Model Card; the numbering matches appendix B of the documentation.
 */
export interface Source {
  short: string
  full: string
}

export const SOURCES = {
  altmann2002: { short: 'Altmann & Trafton 2002', full: 'Altmann, E. M., & Trafton, J. G. (2002). Memory for goals: An activation-based model. Cognitive Science, 26(1), 39–83.' },
  ariga2011: { short: 'Ariga & Lleras 2011', full: 'Ariga, A., & Lleras, A. (2011). Brief and rare mental "breaks" keep you focused. Cognition, 118(3), 439–443.' },
  boksem2008: { short: 'Boksem & Tops 2008', full: 'Boksem, M. A. S., & Tops, M. (2008). Mental fatigue: Costs and benefits. Brain Research Reviews, 59(1), 125–139.' },
  cowan2001: { short: 'Cowan 2001', full: 'Cowan, N. (2001). The magical number 4 in short-term memory. Behavioral and Brain Sciences, 24(1), 87–114.' },
  fitz2019: { short: 'Fitz et al. 2019', full: 'Fitz, N., Kushlev, K., Jagannathan, R., Lewis, T., Paliwal, D., & Ariely, D. (2019). Batching smartphone notifications can improve well-being. Computers in Human Behavior, 101, 84–94.' },
  hart2006: { short: 'Hart 2006', full: 'Hart, S. G. (2006). NASA-Task Load Index (NASA-TLX); 20 years later. Proc. HFES Annual Meeting, 50(9), 904–908.' },
  hart1988: { short: 'Hart & Staveland 1988', full: 'Hart, S. G., & Staveland, L. E. (1988). Development of NASA-TLX. In Human Mental Workload (pp. 139–183). North-Holland.' },
  leroy2009: { short: 'Leroy 2009', full: 'Leroy, S. (2009). Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. OBHDP, 109(2), 168–181.' },
  mark2005: { short: 'Mark et al. 2005', full: 'Mark, G., González, V. M., & Harris, J. (2005). No task left behind? Examining the nature of fragmented work. Proc. CHI 2005, 321–330.' },
  mark2008: { short: 'Mark et al. 2008', full: 'Mark, G., Gudith, D., & Klocke, U. (2008). The cost of interrupted work: More speed and stress. Proc. CHI 2008, 107–110.' },
  masicampo2011: { short: 'Masicampo & Baumeister 2011', full: 'Masicampo, E. J., & Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. JPSP, 101(4), 667–683.' },
  monsell2003: { short: 'Monsell 2003', full: 'Monsell, S. (2003). Task switching. Trends in Cognitive Sciences, 7(3), 134–140.' },
  rogers1995: { short: 'Rogers & Monsell 1995', full: 'Rogers, R. D., & Monsell, S. (1995). Costs of a predictable switch between simple cognitive tasks. JEP: General, 124(2), 207–231.' },
  rubinstein2001: { short: 'Rubinstein et al. 2001', full: 'Rubinstein, J. S., Meyer, D. E., & Evans, J. E. (2001). Executive control of cognitive processes in task switching. JEP: HPP, 27(4), 763–797.' },
  stothart2015: { short: 'Stothart et al. 2015', full: 'Stothart, C., Mitchum, A., & Yehnert, C. (2015). The attentional cost of receiving a cell phone notification. JEP: HPP, 41(4), 893–897.' },
  sweller1988: { short: 'Sweller 1988', full: 'Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. Cognitive Science, 12(2), 257–285.' },
  sweller1998: { short: 'Sweller et al. 1998', full: 'Sweller, J., van Merriënboer, J. J. G., & Paas, F. G. W. C. (1998). Cognitive architecture and instructional design. Educational Psychology Review, 10(3), 251–296.' },
  teigen1994: { short: 'Teigen 1994', full: 'Teigen, K. H. (1994). Yerkes-Dodson: A law for all seasons. Theory & Psychology, 4(4), 525–547.' },
  yerkes1908: { short: 'Yerkes & Dodson 1908', full: 'Yerkes, R. M., & Dodson, J. D. (1908). The relation of strength of stimulus to rapidity of habit-formation. J. Comparative Neurology and Psychology, 18(5), 459–482.' },
} as const satisfies Record<string, Source>

export type SourceId = keyof typeof SOURCES
