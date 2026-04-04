# Generate test fixtures for rds-js
# Run: Rscript test/fixtures/generate.R

dir <- "test/fixtures"

# 1. Simple integer vector
saveRDS(c(1L, 2L, 3L, 4L, 5L), file.path(dir, "integers.rds"))

# 2. Double/real vector
saveRDS(c(1.1, 2.2, 3.3), file.path(dir, "doubles.rds"))

# 3. String vector
saveRDS(c("hello", "world", "foo"), file.path(dir, "strings.rds"))

# 4. Logical vector
saveRDS(c(TRUE, FALSE, TRUE, FALSE), file.path(dir, "logicals.rds"))

# 5. Integer vector with NA
saveRDS(c(1L, NA_integer_, 3L), file.path(dir, "integers_na.rds"))

# 6. Double vector with NA
saveRDS(c(1.1, NA_real_, 3.3), file.path(dir, "doubles_na.rds"))

# 7. String vector with NA
saveRDS(c("hello", NA_character_, "world"), file.path(dir, "strings_na.rds"))

# 8. Logical vector with NA
saveRDS(c(TRUE, NA, FALSE), file.path(dir, "logicals_na.rds"))

# 9. Factor
saveRDS(factor(c("red", "blue", "red", "green")), file.path(dir, "factor.rds"))

# 10. Simple data frame
df <- data.frame(
  name = c("Alice", "Bob", "Charlie"),
  age = c(30L, 25L, 35L),
  score = c(95.5, 87.3, 92.1),
  passed = c(TRUE, TRUE, FALSE),
  stringsAsFactors = FALSE
)
saveRDS(df, file.path(dir, "dataframe.rds"))

# 11. Data frame with NAs
df_na <- data.frame(
  x = c(1L, NA_integer_, 3L),
  y = c("a", NA_character_, "c"),
  z = c(1.1, 2.2, NA_real_),
  stringsAsFactors = FALSE
)
saveRDS(df_na, file.path(dir, "dataframe_na.rds"))

# 12. Data frame with factor column
df_factor <- data.frame(
  team = factor(c("Adelaide", "Brisbane", "Carlton")),
  wins = c(10L, 8L, 12L)
)
saveRDS(df_factor, file.path(dir, "dataframe_factor.rds"))

# 13. Date vector
saveRDS(as.Date(c("2024-01-15", "2024-06-30", "2024-12-25")), file.path(dir, "dates.rds"))

# 14. POSIXct datetime vector
saveRDS(
  as.POSIXct(c("2024-01-15 10:30:00", "2024-06-30 14:00:00"), tz = "UTC"),
  file.path(dir, "datetimes.rds")
)

# 15. NULL
saveRDS(NULL, file.path(dir, "null.rds"))

# 16. Named list (not a data frame)
saveRDS(list(a = 1L, b = "hello", c = TRUE), file.path(dir, "named_list.rds"))

# 17. Empty data frame
saveRDS(data.frame(), file.path(dir, "empty_dataframe.rds"))

# 18. Data frame with dates
df_dates <- data.frame(
  name = c("match1", "match2"),
  date = as.Date(c("2024-03-15", "2024-03-22")),
  stringsAsFactors = FALSE
)
saveRDS(df_dates, file.path(dir, "dataframe_dates.rds"))

# 19. Raw bytes
saveRDS(as.raw(c(0x00, 0x01, 0x02, 0xff)), file.path(dir, "raw.rds"))

# 20. Single scalar values
saveRDS(42L, file.path(dir, "scalar_int.rds"))
saveRDS(3.14, file.path(dir, "scalar_double.rds"))
saveRDS("hello", file.path(dir, "scalar_string.rds"))

# 21. Factor with NA
saveRDS(factor(c("red", NA, "green")), file.path(dir, "factor_na.rds"))

# 22. Large data frame (1000 rows, mixed types) for integration testing
set.seed(42)
large_df <- data.frame(
  id = 1:1000,
  name = paste0("item_", 1:1000),
  value = rnorm(1000),
  category = factor(sample(c("A", "B", "C"), 1000, replace = TRUE)),
  active = sample(c(TRUE, FALSE, NA), 1000, replace = TRUE),
  date = as.Date("2020-01-01") + 0:999,
  stringsAsFactors = FALSE
)
saveRDS(large_df, file.path(dir, "large_dataframe.rds"))

cat("Generated", length(list.files(dir, pattern = "\\.rds$")), "fixture files\n")
