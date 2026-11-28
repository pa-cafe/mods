use fs2::FileExt;
use serde_json::{Value, json};
use std::fs::OpenOptions;
use std::io::{self, Read, Write};
use tokscale_core::{
    GraphResultV2, ReportOptions, generate_source_graph_report_v2, scanner::ScannerSettings,
};

fn upload_graph(graph: GraphResultV2) -> Value {
    json!({
        "meta": {
            "generatedAt": graph.meta.generated_at,
            "version": graph.meta.version,
        },
        "contributions": graph.contributions.iter()
            .filter(|day| day.totals.tokens > 0 && !day.clients.is_empty())
            .map(|day| json!({
                "date": day.date,
                // The preview uses cached pricing only. Its cost is not a verified bill.
                "totals": {"tokens": day.totals.tokens, "cost": day.totals.cost,
                    "messages": day.totals.messages, "costIsComplete": false},
                "clients": day.clients.iter().map(|row| json!({
                    "client": row.client, "modelId": row.model_id, "providerId": row.provider_id,
                    "tokens": {
                        "input": row.tokens.input, "output": row.tokens.output,
                        "cacheRead": row.tokens.cache_read,
                        "cacheWrite": row.tokens.cache_write,
                        "reasoning": row.tokens.reasoning
                    },
                    "cost": row.cost, "messages": row.messages,
                    "costMetadata": {"currency": "USD", "provenance": "estimated",
                        "pricingVersion": null, "source": "Tokscale core cache"}
                })).collect::<Vec<_>>()
            })).collect::<Vec<_>>()
    })
}

fn main() -> Result<(), &'static str> {
    let mut args = std::env::args_os().skip(1);
    if let Some(action) = args.next() {
        if action != "--hold-lock" {
            return Err("Invalid scanner operation");
        }
        let file = args.next().ok_or("Missing lock path")?;
        if args.next().is_some() {
            return Err("Invalid lock path");
        }
        let lock = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(file)
            .map_err(|_| "Failed to open local lock")?;
        if FileExt::try_lock_exclusive(&lock).is_err() {
            println!("busy");
            return Ok(());
        }
        println!("locked");
        io::stdout()
            .flush()
            .map_err(|_| "Could not report local lock")?;
        // The OS releases the advisory lock when the process exits. The Node
        // parent's stdin pipe closes even when it quits or is forcibly killed.
        let _ = io::stdin().read(&mut [0_u8]);
        return Ok(());
    }
    if std::env::var("TOKSCALE_PRICING_CACHE_ONLY").as_deref() != Ok("1")
        || std::env::var_os("TOKSCALE_CONFIG_DIR").is_none()
    {
        return Err("Offline cache sandbox is required");
    }
    // Read scanner options only; produce no transcript/context, network call, or credentials.
    let mut scanner = String::new();
    io::stdin()
        .take(64 * 1024)
        .read_to_string(&mut scanner)
        .map_err(|_| "Unable to read scanner settings")?;
    let scanner_settings: ScannerSettings =
        serde_json::from_str(&scanner).map_err(|_| "Invalid scanner settings")?;
    let runtime = tokio::runtime::Runtime::new().map_err(|_| "Unable to start parser")?;
    let graph = runtime
        .block_on(generate_source_graph_report_v2(ReportOptions {
            clients: Some(vec!["codex".into(), "claude".into()]),
            scanner_settings,
            use_env_roots: true,
            ..Default::default()
        }))
        .map_err(|_| "Unable to scan usage")?;
    println!("{}", upload_graph(graph));
    Ok(())
}
