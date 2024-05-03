
pacman::p_load(tidyverse, dplyr, tidyr, stringr, xml2)


# Read in the data
data <- read_csv("animalfeatures_2024-04-26.csv")

# Convert the data to a tibble
data <- as_tibble(data)

# remove trials with an empty or NA prolfic_id
data <- data %>% filter(!is.na(prolific_id) & prolific_id != "")

# remove trials with an empty or NA svg
data <- data %>% filter(!is.na(`svg`) & `svg` != "")

# extract paths (layers) from each row's whole SVG data
path_data <- data %>% mutate(paths = map(`svg`, ~{
  xml2::read_xml(.x) %>%
    xml2::xml_ns_strip() %>%
    xml2::xml_find_all(".//path") %>%
    xml2::xml_attr("d")
}))

# unnest the paths adding a sequential id
path_data <- path_data %>% unnest(paths) %>% group_by(prolific_id, condition, trial) %>% mutate(path_id = row_number()) %>% ungroup()
point_data[6:20, 25:26]
# now extract individual points from each path, but some only have one point
point_data <- path_data %>% mutate(points = map(paths, ~{
        str_trim(.x) %>%
        str_split("M|L") %>%
        unlist() %>%
        str_trim() %>%
        discard(~.x == "")
})) %>% unnest(points) %>% group_by(prolific_id, condition, trial, path_id) %>% mutate(point_id = row_number()) %>% ungroup()

# drop svg and paths columns
point_data <- point_data %>% select(-`svg`, -paths)

# change points to new columns x and y
point_data <- point_data %>% separate_wider_delim(cols = points, delim = " ", names = c("x", "y"), cols_remove = TRUE)
# make sure x and y are numeric floats
point_data <- point_data %>% mutate(x = as.numeric(x), y = as.numeric(y))

# write out the data
write_csv(point_data, "animalfeatures_2024-04-26_points.csv")
