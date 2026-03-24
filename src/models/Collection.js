import { model, Schema } from 'mongoose';
const metaData = new Schema({
    webcrawler: {
        options: Object,
        jobId: String,
        lastUpdate: Schema.Types.Mixed,
        urls: [String]
    },
    chunkingDetails: {
        strategy: { type: String, enum: ["recursiveStructural", "recursiveSemantic"], default: 'recursiveStructural' },
        tunables: {
            MIN_TOKENS: { type: Number, default: 30 },
            MAX_TOKENS: { type: Number, default: 512 },
            OVERLAP_TOKENS: { type: Number, default: 50 },
        }
    },
    parserDetails: {
        tier: { type: String, enum: ['fast', 'cost_effective', 'agentic', "agentic_plus"], default: 'cost_effective' },
        expand: { type: [String], enum: ['text', 'items', "markdown", 'metadata', 'images_content_metadata', 'xlsx_content_metadata', 'output_pdf_content_metadata'], default: ['items', "markdown", 'metadata', 'images_content_metadata'] },
        version: { type: String, enum: ['latest'], default: 'latest' },
        source_url: String,
        advancedOptions: {
            page_ranges: {
                target_pages: String,
                max_pages: Number,
            },
            disable_cache: Boolean,
            agentic_options: {
                custom_prompt: String
            },
            output_options: {
                extract_printed_page_number: Boolean,
                images_to_save: { type: [String], enum: ["screenshot", "embedded", "layout"] },
                markdown: {
                    annotate_links: Boolean,
                    inline_images: Boolean,
                    tables: {
                        compact_markdown_tables: Boolean,
                        markdown_table_multiline_separator: String,
                        merge_continued_tables: Boolean,
                        output_tables_as_markdown: Boolean,
                    },
                    spatial_text: {
                        do_not_unroll_columns: Boolean,
                        preserve_layout_alignment_across_pages: Boolean,
                        preserve_very_small_text: Boolean,
                    },
                    tables_as_spreadsheet: {
                        enable: Boolean,
                        guess_sheet_name: Boolean,
                    },
                }
            },
            input_options: {
                html: {
                    make_all_elements_visible: Boolean,
                    remove_fixed_elements: Boolean,
                    remove_navigation_elements: Boolean,
                },
                presentation: {
                    out_of_bounds_content: Boolean,
                    skip_embedded_data: Boolean,
                },
                spreadsheet: {
                    detect_sub_tables_in_sheets: Boolean,
                    force_formula_computation_in_sheets: Boolean,
                    include_hidden_sheets: Boolean,
                },
            },
            processing_options: {
                aggressive_table_extraction: Boolean,
                cost_optimizer: {
                    enable: Boolean,
                },
                disable_heuristics: Boolean,
                ignore: {
                    ignore_diagonal_text: Boolean,
                    ignore_text_in_image: Boolean,
                    ignore_hidden_text: Boolean,
                },
                ocr_parameters: {
                    languages: { type: [String], enum: ["en", "fr", "de", "es", "it", "pt", "ru", "zh"] },
                },
                specialized_chart_parsing: { type: String, enum: ["agentic_plus", "agentic", "efficient"] }
            },
            // webhook_configurations: {
            //     webhook_events: { type: [String], enum: ["parsing_completed", "parsing_failed", "parsing_progress"] },
            //     webhook_headers: { type: Object },
            //     webhook_url: { type: String },
            // },
            processing_control: {
                job_failure_conditions: {
                    allowed_page_failure_ratio: Number,
                    fail_on_buggy_font: Boolean,
                    fail_on_image_extraction_error: Boolean,
                    fail_on_image_ocr_error: Boolean,
                    fail_on_markdown_reconstruction_error: Boolean,
                },
                timeouts: {
                    base_in_seconds: Number,
                    extra_time_per_page_in_seconds: Number,
                },
            }
        },
        jobId: String,
        lastUpdate: Schema.Types.Mixed,
    },
    progressStages: [{
        name: { type: String, enum: ['webcrawler', 'embed and upsert', 'Chunking', 'Parsing'] },
        accomplished: { type: Boolean, default: false },
        status: { type: String, default: "PENDING", enum: ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] },
        error: { type: String },
        startedAt: { type: Date, default: Date.now },
        completedAt: { type: Date },
        failedAt: { type: Date },
        moreInfo: { type: Schema.Types.Mixed }
    }],
}, { _id: false });
const CollectionSchema = new Schema({
    name: { type: String, required: true, },
    source: { type: String, enum: ['website', 'youtube', 'file', 'text'] },
    status: { type: String, default: "loading", enum: ["active", "loading", "failed", "cancelled"] },
    error: { type: String },
    metaData: metaData,
    description: { type: String },
    tags: [String],
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false }
}, {
    timestamps: true
});
export const Collection = model('Collection', CollectionSchema, "Collection");