library(jsonlite)

readtsv <- function(filename) {
  return(read.delim(filename, header = TRUE, sep = "\t"))
}

sdf1995 <- readtsv('data/sdf95c1d.txt')
sdf1996 <- readtsv('data/sdf96c1b.txt')
sdf1997 <- readtsv('data/sdf97d1a.txt')
sdf1998 <- readtsv('data/sdf98d1e.txt')
sdf1999 <- readtsv('data/sdf991c.txt')
sdf2000 <- readtsv('data/sdf001d.txt')
sdf2001 <- readtsv('data/sdf011d.txt')
sdf2002 <- readtsv('data/sdf021c.txt')
sdf2003 <- readtsv('data/sdf031b.txt')
sdf2004 <- readtsv('data/sdf041b.txt')
sdf2005 <- readtsv('data/sdf051c.txt')
sdf2006 <- readtsv('data/sdf061a.txt')
sdf2007 <- readtsv('data/sdf071a.txt')
sdf2008 <- readtsv('data/sdf081a.txt')
sdf2009 <- readtsv('data/SDF091a.txt')
sdf2010 <- readtsv('data/sdf101a_txt.txt')
sdf2011 <- readtsv('data/sdf11_1a.txt')
  
sdf <- list(sdf1995, sdf1996, sdf1997,
            sdf1998, sdf1999, sdf2000,
            sdf2001, sdf2002, sdf2003,
            sdf2004, sdf2005, sdf2006,
            sdf2007, sdf2008, sdf2009,
            sdf2010, sdf2011)

data <- NULL

for (collection in sdf) {
  rows <- NULL

  if ('AGCHRT' %in% colnames(collection)) {
    rows <- subset(collection,
                     !is.na(LEAID) & (AGCHRT == 2 | AGCHRT == 3 | (YEAR = 98 & AGCHRT == 'N')),
                     select = c(LEAID, NAME, STABBR, YEAR, TOTALREV, X_41F, X_66V))
  } else {
    rows <- subset(collection,
                     !is.na(LEAID),
                     select = c(LEAID, NAME, STABBR, YEAR, TOTALREV, X_41F, X_66V))
  }
  
  data <- rbind(data, rows)
  
}

data$NAME <- as.character(data$NAME)

data$YEAR <- factor(data$YEAR,
                    levels = c(95, 96, 97,
                               98, 99, 00,
                               01, 02, 03,
                               04, 05, 06,
                               07, 08, 09,
                               10, 11),
                    labels = c(1995, 1996, 1997,
                               1998, 1999, 2000,
                               2001, 2002, 2003,
                               2004, 2005, 2006,
                               2007, 2008, 2009,
                               2010, 2011))

data$TOTALDEBT <- data$X_41F + data$X_66V
data <- data[,!(names(data) %in% c('X_41F', 'X_66V'))]

cpi <- read.csv('data/cpi.csv', header = FALSE, col.names = c('YEAR', 'CPI'))

inflationX <- function(baseyear) {
  multipliers <- data.frame(YEAR = cpi$YEAR, MULTIPLIER = cpi$CPI[cpi$YEAR==baseyear] / cpi$CPI)
  lookup <- Vectorize(function(amount, year) {
    return(amount * multipliers$MULTIPLIER[multipliers$YEAR==year])
  })
  return(lookup)
}

adj2011dollars <- inflationX(2011)

data$TOTALREV <- round(adj2011dollars(data$TOTALREV, data$YEAR))
data$TOTALDEBT <- round(adj2011dollars(data$TOTALDEBT, data$YEAR))

# export <- toJSON(lapply(unique(data$LEAID), function(leaid) {
#   matches <- data[data$LEAID==leaid,]
#   matches$YEAR <- as.numeric(levels(matches$YEAR))[matches$YEAR]
#   obj <- list(ID = unbox(leaid),
#               NAME = unbox(matches$NAME[1]),
#               STATE = unbox(as.character(matches$STABBR[1])),
#               VALUES = matches[,names(data) %in% c('YEAR', 'TOTALREV', 'TOTALDEBT')])
#   return(obj)
# }))

usTotalRev <- aggregate(data$TOTALREV, list(YEAR = data$YEAR), sum)
names(usTotalRev)[2] <- 'TOTALREV'
usTotalDebt <- aggregate(data$TOTALDEBT, list(YEAR = data$YEAR), sum)
names(usTotalDebt)[2] <- 'TOTALDEBT'
usSums <- merge(usTotalRev, usTotalDebt, by = 'YEAR')

export <- toJSON(list(
  VALUES = usSums,
  STATES = lapply(unique(data$STABBR), function(state) {
    matches <- data[data$STABBR==state,]
    matches$YEAR <- as.numeric(levels(matches$YEAR))[matches$YEAR]
    
    state <- as.character(matches$STABBR[1])
    stateTotalRev <- aggregate(matches$TOTALREV, list(YEAR = matches$YEAR), sum)
    names(stateTotalRev)[2] <- 'TOTALREV'
    stateTotalDebt <- aggregate(matches$TOTALDEBT, list(YEAR = matches$YEAR), sum)
    names(stateTotalDebt)[2] <- 'TOTALDEBT'
    
    sums <- merge(stateTotalRev, stateTotalDebt, by = 'YEAR')
    
    obj <- list(
      STATE = unbox(state),
      VALUES = sums,
      LEAS = lapply(unique(matches$LEAID), function(leaid) {
        leamatches <- matches[matches$LEAID==leaid,]
        obj <- list(ID = unbox(leaid),
                    NAME = unbox(leamatches$NAME[1]),
                    VALUES = leamatches[,names(data) %in% c('YEAR', 'TOTALREV', 'TOTALDEBT')])
        return(obj)
      }))
    return(obj)
  })))

cat(export, file = 'data.json')
